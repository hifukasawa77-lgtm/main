package com.hide.intlcallblocker.core

/**
 * 発着信 1 件の可否を決める中核エンジン / The core screening decision engine.
 *
 * Android の API に一切依存しない。`CallScreeningService` / `CallRedirectionService` は
 * 番号文字列と向きを渡してここの結論を実行するだけの薄い層に留める。
 *
 * ### 判定順序（この順序自体が安全性の要）
 * 1. 緊急通報            … 設定・許可リストに関わらず必ず通す
 * 2. MMI / USSD（発信）  … 必ず通す（`*#06#` 等を横取りしない）
 * 3. 許可リスト          … 一致すれば通す
 * 4. 非通知・番号不明    … 設定に従う
 * 5. 国際                … 設定に従う（着信／発信で別設定）
 * 6. 書式不明            … 設定に従う（既定は通す）
 * 7. それ以外（国内）    … 通す
 */
class CallScreeningEngine(
    private val plan: DialPlan = DialPlan.JAPAN,
    private val policy: ScreeningPolicy = ScreeningPolicy.DEFAULT,
    private val allowList: AllowList = AllowList.empty(),
) {

    /** 分類だけの中間結果。 */
    data class Classification(
        val origin: CallOrigin,
        val e164: String?,
        val countryCode: String?,
    )

    /**
     * 相手番号を分類する。
     *
     * @param rawNumber   `tel:` URI でも整形済み表記でもよい。取得できなければ null。
     * @param numberPresented 番号が提示されているか。非通知・公衆電話・圏外表示なら false。
     */
    fun classify(rawNumber: String?, numberPresented: Boolean = true): Classification {
        if (!numberPresented) {
            return Classification(CallOrigin.WITHHELD, null, null)
        }
        val normalized = PhoneNumbers.normalize(rawNumber)
            ?: return Classification(CallOrigin.WITHHELD, null, null)

        if (PhoneNumbers.isMmiCode(normalized)) {
            return Classification(CallOrigin.MMI, normalized, null)
        }

        val digits = PhoneNumbers.digitsOnly(normalized)
        if (digits.isEmpty()) {
            return Classification(CallOrigin.WITHHELD, null, null)
        }
        if (digits in plan.emergencyNumbers) {
            return Classification(CallOrigin.EMERGENCY, digits, null)
        }

        // --- 明示的な国際形式（+国番号） ---
        if (normalized.startsWith("+")) {
            return if (digits.startsWith(plan.homeCountryCode)) {
                Classification(CallOrigin.DOMESTIC, "+$digits", plan.homeCountryCode)
            } else {
                Classification(CallOrigin.INTERNATIONAL, "+$digits", CountryCodes.extract(digits))
            }
        }

        // --- 国際発信プレフィックス（010 / 事業者選択番号 + 010） ---
        val afterIdd = PhoneNumbers.stripInternationalPrefix(digits, plan)
        if (afterIdd != null) {
            // 010 経由でも宛先が自国なら「国内あて」。遮断対象は宛先が国外のときだけ。
            return if (afterIdd.startsWith(plan.homeCountryCode)) {
                Classification(CallOrigin.DOMESTIC, "+$afterIdd", plan.homeCountryCode)
            } else {
                Classification(CallOrigin.INTERNATIONAL, "+$afterIdd", CountryCodes.extract(afterIdd))
            }
        }

        // --- 事業者選択番号だけで 010 を伴わない `00…` は書式不明 ---
        if (digits.startsWith("00")) {
            return Classification(CallOrigin.UNKNOWN, normalized, null)
        }

        // --- 国内表記（先頭が trunk prefix） ---
        if (plan.trunkPrefix.isNotEmpty() &&
            digits.startsWith(plan.trunkPrefix) &&
            digits.length > plan.trunkPrefix.length
        ) {
            val national = digits.substring(plan.trunkPrefix.length)
            return Classification(
                CallOrigin.DOMESTIC,
                "+" + plan.homeCountryCode + national,
                plan.homeCountryCode,
            )
        }

        // --- 3〜4 桁の国内特番（117 / 171 / 189 など） ---
        if (digits.length in plan.shortCodeLengths) {
            return Classification(CallOrigin.SHORT_CODE, digits, plan.homeCountryCode)
        }

        return Classification(CallOrigin.UNKNOWN, normalized, null)
    }

    /**
     * 発着信 1 件の可否を決める。
     *
     * @param rawNumber       相手番号（`tel:` URI 可、取得できなければ null）
     * @param direction       着信か発信か
     * @param numberPresented 番号が提示されているか（非通知なら false）
     */
    fun decide(
        rawNumber: String?,
        direction: CallDirection,
        numberPresented: Boolean = true,
    ): CallDecision {
        val c = classify(rawNumber, numberPresented)

        // 1. 緊急通報は無条件で通す。
        if (c.origin == CallOrigin.EMERGENCY) {
            return CallDecision(
                CallAction.ALLOW, c.origin, DecisionReason.EMERGENCY_ALWAYS_ALLOWED, c.e164, c.countryCode,
            )
        }

        // 2. 発信の MMI / USSD は横取りしない。着信で来ることは無いので書式不明扱いに落とす。
        if (c.origin == CallOrigin.MMI) {
            return if (direction == CallDirection.OUTGOING) {
                CallDecision(
                    CallAction.ALLOW, c.origin, DecisionReason.MMI_PASSTHROUGH, c.e164, c.countryCode,
                )
            } else {
                decideByRule(
                    c.copy(origin = CallOrigin.UNKNOWN), direction,
                )
            }
        }

        // 3. 許可リスト。
        allowList.match(c.e164 ?: rawNumber)?.let { rule ->
            return CallDecision(
                CallAction.ALLOW, c.origin, DecisionReason.ALLOW_LIST_MATCH, c.e164, c.countryCode, rule.pattern,
            )
        }

        return decideByRule(c, direction)
    }

    private fun decideByRule(c: Classification, direction: CallDirection): CallDecision {
        fun allow(reason: DecisionReason) =
            CallDecision(CallAction.ALLOW, c.origin, reason, c.e164, c.countryCode)

        fun block(reason: DecisionReason) =
            CallDecision(CallAction.BLOCK, c.origin, reason, c.e164, c.countryCode)

        return when (c.origin) {
            CallOrigin.WITHHELD ->
                if (direction == CallDirection.INCOMING && policy.blockWithheldIncoming) {
                    block(DecisionReason.WITHHELD_BLOCKED)
                } else {
                    allow(DecisionReason.FEATURE_DISABLED)
                }

            CallOrigin.INTERNATIONAL ->
                when (direction) {
                    CallDirection.INCOMING ->
                        if (policy.blockInternationalIncoming) {
                            block(DecisionReason.INTERNATIONAL_INCOMING_BLOCKED)
                        } else {
                            allow(DecisionReason.FEATURE_DISABLED)
                        }

                    CallDirection.OUTGOING ->
                        if (policy.blockInternationalOutgoing) {
                            block(DecisionReason.INTERNATIONAL_OUTGOING_BLOCKED)
                        } else {
                            allow(DecisionReason.FEATURE_DISABLED)
                        }
                }

            CallOrigin.UNKNOWN ->
                if (direction == CallDirection.INCOMING && policy.blockUnknownFormatIncoming) {
                    block(DecisionReason.UNKNOWN_FORMAT_BLOCKED)
                } else {
                    allow(DecisionReason.NO_RULE_MATCHED)
                }

            CallOrigin.DOMESTIC,
            CallOrigin.SHORT_CODE,
            CallOrigin.EMERGENCY,
            CallOrigin.MMI,
            -> allow(DecisionReason.NO_RULE_MATCHED)
        }
    }
}
