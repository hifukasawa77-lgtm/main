package com.hide.intlcallblocker.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PhoneNumbersTest {

    @Test
    fun `tel URI からスキームを剥がす`() {
        assertEquals("+12025550143", PhoneNumbers.normalize("tel:+12025550143"))
        assertEquals("09012345678", PhoneNumbers.normalize("tel:090-1234-5678"))
        assertEquals("+12025550143", PhoneNumbers.normalize("TEL://+1-202-555-0143"))
    }

    @Test
    fun `sip URI はホスト部を捨てる`() {
        assertEquals("+12025550143", PhoneNumbers.normalize("sip:+12025550143@carrier.example"))
        assertEquals("+442071234567", PhoneNumbers.normalize("sips:+44 20 7123 4567@ims.example"))
    }

    @Test
    fun `区切り記号を除去する`() {
        assertEquals("0312345678", PhoneNumbers.normalize("(03) 1234-5678"))
        assertEquals("+81312345678", PhoneNumbers.normalize("+81 3 1234 5678"))
        assertEquals("0312345678", PhoneNumbers.normalize("03.1234.5678"))
    }

    @Test
    fun `全角数字とプラスを半角へ揃える`() {
        assertEquals("09012345678", PhoneNumbers.normalize("０９０－１２３４－５６７８"))
        assertEquals("+819012345678", PhoneNumbers.normalize("＋８１９０１２３４５６７８"))
    }

    @Test
    fun `ポーズ以降を切り捨てる`() {
        assertEquals("0312345678", PhoneNumbers.normalize("03-1234-5678,,123"))
        assertEquals("0312345678", PhoneNumbers.normalize("0312345678;456"))
        assertEquals("0312345678", PhoneNumbers.normalize("0312345678p99"))
    }

    @Test
    fun `空や記号だけなら null`() {
        assertNull(PhoneNumbers.normalize(null))
        assertNull(PhoneNumbers.normalize(""))
        assertNull(PhoneNumbers.normalize("   "))
        assertNull(PhoneNumbers.normalize("---"))
    }

    @Test
    fun `MMI コードを判別する`() {
        assertTrue(PhoneNumbers.isMmiCode(PhoneNumbers.normalize("*#06#")))
        assertTrue(PhoneNumbers.isMmiCode(PhoneNumbers.normalize("#31#09012345678")))
        assertFalse(PhoneNumbers.isMmiCode(PhoneNumbers.normalize("09012345678")))
    }

    @Test
    fun `国内表記を E164 へ揃える`() {
        val plan = DialPlan.JAPAN
        assertEquals("+819012345678", PhoneNumbers.toE164(PhoneNumbers.normalize("090-1234-5678"), plan))
        assertEquals("+81312345678", PhoneNumbers.toE164(PhoneNumbers.normalize("03-1234-5678"), plan))
        assertEquals("+819012345678", PhoneNumbers.toE164(PhoneNumbers.normalize("+81 90 1234 5678"), plan))
    }

    @Test
    fun `国際発信プレフィックスを剥がす`() {
        val plan = DialPlan.JAPAN
        assertEquals("12025550143", PhoneNumbers.stripInternationalPrefix("01012025550143", plan))
        // 事業者選択番号 + 010
        assertEquals("12025550143", PhoneNumbers.stripInternationalPrefix("003301012025550143", plan))
        assertEquals("12025550143", PhoneNumbers.stripInternationalPrefix("00101012025550143", plan))
        // 国内番号は剥がれない
        assertNull(PhoneNumbers.stripInternationalPrefix("09012345678", plan))
        assertNull(PhoneNumbers.stripInternationalPrefix("0120123456", plan))
    }

    @Test
    fun `桁数の違う事業者選択番号すべてで 010 を見つける`() {
        val plan = DialPlan.JAPAN
        // 001（KDDI・3桁） / 0033（NTTCom・4桁） / 0061（SB・4桁） / 005345（au・6桁）
        for (carrier in listOf("001", "0033", "0061", "0041", "0088", "005345")) {
            assertEquals(
                "12025550143",
                PhoneNumbers.stripInternationalPrefix(carrier + "010" + "12025550143", plan),
                "事業者選択番号 $carrier で 010 を取り逃がしている",
            )
        }
    }

    @Test
    fun `事業者番号の切り出しミスで短すぎる宛先を拾わない`() {
        // 00123 + 010 + 12345 と読めてしまうが、宛先 5 桁は国際番号として成立しない
        assertNull(PhoneNumbers.stripInternationalPrefix("0012301012345", DialPlan.JAPAN))
    }

    @Test
    fun `日本の番号計画では裸の 00 を国際発信としない`() {
        assertNull(PhoneNumbers.stripInternationalPrefix("00441234567", DialPlan.JAPAN))
    }
}
