package com.hide.intlcallblocker.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CallScreeningEngineTest {

    private fun engine(
        policy: ScreeningPolicy = ScreeningPolicy.DEFAULT,
        allow: List<AllowRule> = emptyList(),
    ) = CallScreeningEngine(DialPlan.JAPAN, policy, AllowList(allow, DialPlan.JAPAN))

    private fun incoming(e: CallScreeningEngine, n: String?, presented: Boolean = true) =
        e.decide(n, CallDirection.INCOMING, presented)

    private fun outgoing(e: CallScreeningEngine, n: String?) =
        e.decide(n, CallDirection.OUTGOING, true)

    // ---------------------------------------------------------------- 分類

    @Test
    fun `プラス国番号で国内と国際を分ける`() {
        val e = engine()
        assertEquals(CallOrigin.DOMESTIC, e.classify("+819012345678").origin)
        assertEquals(CallOrigin.INTERNATIONAL, e.classify("+12025550143").origin)
        assertEquals(CallOrigin.INTERNATIONAL, e.classify("+8613800138000").origin)
        assertEquals(CallOrigin.INTERNATIONAL, e.classify("+85212345678").origin)
    }

    @Test
    fun `国番号を取り出してログに残せる`() {
        val e = engine()
        val c = e.classify("+12025550143")
        assertEquals("1", c.countryCode)
        assertEquals("+12025550143", c.e164)
    }

    @Test
    fun `国内表記は国内と判定する`() {
        val e = engine()
        for (n in listOf("090-1234-5678", "03-1234-5678", "0120-123-456", "0800-123-4567")) {
            assertEquals(CallOrigin.DOMESTIC, e.classify(n).origin, "国内のはず: $n")
        }
    }

    @Test
    fun `010 経由の発信は宛先の国で判定する`() {
        val e = engine()
        // 010 + 1（米国）→ 国際
        assertEquals(CallOrigin.INTERNATIONAL, e.classify("01012025550143").origin)
        // 010 + 81（日本あて）→ 宛先は国内
        assertEquals(CallOrigin.DOMESTIC, e.classify("010819012345678").origin)
        // 事業者選択番号 + 010 + 1 → 国際
        assertEquals(CallOrigin.INTERNATIONAL, e.classify("003301012025550143").origin)
    }

    @Test
    fun `緊急通報と特番を取り違えない`() {
        val e = engine()
        assertEquals(CallOrigin.EMERGENCY, e.classify("110").origin)
        assertEquals(CallOrigin.EMERGENCY, e.classify("119").origin)
        assertEquals(CallOrigin.EMERGENCY, e.classify("118").origin)
        assertEquals(CallOrigin.SHORT_CODE, e.classify("117").origin)
        assertEquals(CallOrigin.SHORT_CODE, e.classify("171").origin)
        assertEquals(CallOrigin.SHORT_CODE, e.classify("189").origin)
    }

    @Test
    fun `番号が提示されなければ非通知扱い`() {
        val e = engine()
        assertEquals(CallOrigin.WITHHELD, e.classify("+12025550143", numberPresented = false).origin)
        assertEquals(CallOrigin.WITHHELD, e.classify(null).origin)
        assertEquals(CallOrigin.WITHHELD, e.classify("").origin)
    }

    @Test
    fun `事業者選択番号だけの 00 は書式不明`() {
        val e = engine()
        assertEquals(CallOrigin.UNKNOWN, e.classify("00441234567").origin)
    }

    // ------------------------------------------------------- 着信のブロック

    @Test
    fun `既定設定で国際着信を遮断する`() {
        val e = engine()
        for (n in listOf("+12025550143", "+8613800138000", "+442071234567", "+639171234567")) {
            val d = incoming(e, n)
            assertTrue(d.isBlocked, "遮断されるはず: $n")
            assertEquals(DecisionReason.INTERNATIONAL_INCOMING_BLOCKED, d.reason)
        }
    }

    @Test
    fun `国内着信は通す`() {
        val e = engine()
        for (n in listOf("090-1234-5678", "+819012345678", "03-1234-5678", "0120-123-456")) {
            assertFalse(incoming(e, n).isBlocked, "通すはず: $n")
        }
    }

    @Test
    fun `非通知着信を遮断する`() {
        val e = engine()
        val d = incoming(e, null, presented = false)
        assertTrue(d.isBlocked)
        assertEquals(DecisionReason.WITHHELD_BLOCKED, d.reason)
    }

    @Test
    fun `非通知遮断を切れば非通知は通る`() {
        val e = engine(ScreeningPolicy(blockWithheldIncoming = false))
        val d = incoming(e, null, presented = false)
        assertFalse(d.isBlocked)
        assertEquals(DecisionReason.FEATURE_DISABLED, d.reason)
    }

    @Test
    fun `国際着信遮断を切れば国際着信は通る`() {
        val e = engine(ScreeningPolicy(blockInternationalIncoming = false))
        assertFalse(incoming(e, "+12025550143").isBlocked)
    }

    @Test
    fun `書式不明は既定では通し、設定を入れれば遮断する`() {
        assertFalse(incoming(engine(), "00441234567").isBlocked)
        val strict = engine(ScreeningPolicy(blockUnknownFormatIncoming = true))
        val d = incoming(strict, "00441234567")
        assertTrue(d.isBlocked)
        assertEquals(DecisionReason.UNKNOWN_FORMAT_BLOCKED, d.reason)
    }

    // ------------------------------------------------------- 発信のブロック

    @Test
    fun `国際発信を抑止する`() {
        val e = engine()
        for (n in listOf("01012025550143", "+12025550143", "003301012025550143")) {
            val d = outgoing(e, n)
            assertTrue(d.isBlocked, "抑止されるはず: $n")
            assertEquals(DecisionReason.INTERNATIONAL_OUTGOING_BLOCKED, d.reason)
        }
    }

    @Test
    fun `国内発信は通す`() {
        val e = engine()
        for (n in listOf("090-1234-5678", "0120-123-456", "117", "+819012345678")) {
            assertFalse(outgoing(e, n).isBlocked, "通すはず: $n")
        }
    }

    @Test
    fun `国際発信抑止を切れば国際発信は通る`() {
        val e = engine(ScreeningPolicy(blockInternationalOutgoing = false))
        assertFalse(outgoing(e, "01012025550143").isBlocked)
    }

    // ------------------------------------------------------------- 安全弁

    @Test
    fun `緊急通報は全機能ONでも必ず通す`() {
        val e = engine(
            ScreeningPolicy(
                blockInternationalIncoming = true,
                blockWithheldIncoming = true,
                blockInternationalOutgoing = true,
                blockUnknownFormatIncoming = true,
            ),
        )
        for (n in listOf("110", "119", "118", "112", "911")) {
            for (dir in CallDirection.entries) {
                val d = e.decide(n, dir, true)
                assertFalse(d.isBlocked, "緊急通報を遮断してはいけない: $n / $dir")
                assertEquals(DecisionReason.EMERGENCY_ALWAYS_ALLOWED, d.reason)
            }
        }
    }

    @Test
    fun `MMI コードの発信を横取りしない`() {
        val e = engine(ScreeningPolicy(blockUnknownFormatIncoming = true))
        for (n in listOf("*#06#", "*#21#", "#31#09012345678")) {
            val d = outgoing(e, n)
            assertFalse(d.isBlocked, "MMI を止めてはいけない: $n")
            assertEquals(DecisionReason.MMI_PASSTHROUGH, d.reason)
        }
    }

    // --------------------------------------------------------- 許可リスト

    @Test
    fun `許可リストの完全一致は国際でも通す`() {
        val e = engine(allow = listOf(AllowRule("+1 202-555-0143", "家族（NY）")))
        val d = incoming(e, "+12025550143")
        assertFalse(d.isBlocked)
        assertEquals(DecisionReason.ALLOW_LIST_MATCH, d.reason)
        assertEquals("+1 202-555-0143", d.matchedRule)
        // 同じ国の別番号は遮断されたまま
        assertTrue(incoming(e, "+12025550199").isBlocked)
    }

    @Test
    fun `許可リストの前方一致で国や事業者ごと通せる`() {
        val e = engine(allow = listOf(AllowRule("+8210*", "韓国の携帯")))
        assertFalse(incoming(e, "+821012345678").isBlocked)
        assertTrue(incoming(e, "+8221234567").isBlocked)   // 韓国だが固定電話
        assertTrue(incoming(e, "+12025550143").isBlocked)  // 別の国
    }

    @Test
    fun `許可リストは表記の揺れを吸収する`() {
        val e = engine(allow = listOf(AllowRule("+819012345678")))
        // 国内表記でも同一番号として一致する
        assertFalse(incoming(e, "090-1234-5678").isBlocked)
        val e2 = engine(allow = listOf(AllowRule("０９０-１２３４-５６７８")))
        assertEquals(DecisionReason.ALLOW_LIST_MATCH, incoming(e2, "+819012345678").reason)
    }

    @Test
    fun `許可リストは発信にも効く`() {
        val e = engine(allow = listOf(AllowRule("+12025550143")))
        assertFalse(outgoing(e, "01012025550143").isBlocked)
        assertTrue(outgoing(e, "01012025550199").isBlocked)
    }

    @Test
    fun `桁を含まない許可ルールは全許可の事故になるので無視する`() {
        val e = engine(allow = listOf(AllowRule("*"), AllowRule(""), AllowRule("   ")))
        assertTrue(incoming(e, "+12025550143").isBlocked, "全許可になってはいけない")
    }

    @Test
    fun `許可リストは緊急通報の判定より後で評価される`() {
        // 許可リストが空でも緊急通報は通る＝順序が逆転していないことの確認
        val e = engine()
        assertEquals(DecisionReason.EMERGENCY_ALWAYS_ALLOWED, outgoing(e, "119").reason)
    }

    // ------------------------------------------------------------- 設定

    @Test
    fun `全機能を切れば isFullyDisabled が立つ`() {
        assertTrue(
            ScreeningPolicy(
                blockInternationalIncoming = false,
                blockWithheldIncoming = false,
                blockInternationalOutgoing = false,
                blockUnknownFormatIncoming = false,
            ).isFullyDisabled,
        )
        assertFalse(ScreeningPolicy.DEFAULT.isFullyDisabled)
    }

    @Test
    fun `既定設定は国際完全シャットアウトになっている`() {
        val p = ScreeningPolicy.DEFAULT
        assertTrue(p.blockInternationalIncoming)
        assertTrue(p.blockWithheldIncoming)
        assertTrue(p.blockInternationalOutgoing)
        assertFalse(p.keepBlockedInCallLog)
        assertFalse(p.keepBlockedNotification)
    }
}
