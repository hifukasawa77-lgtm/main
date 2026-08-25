package com.hide.intlcallblocker.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CountryCodesTest {

    /**
     * E.164 の国番号は接頭辞符号（prefix-free code）でなければならない。
     * これが崩れると最長一致の抽出が別の国を指す。手打ちの表なので機械検査する。
     */
    @Test
    fun `国番号テーブルは接頭辞符号である`() {
        val codes = CountryCodes.allCodes()
        val violations = mutableListOf<String>()
        for (a in codes) {
            for (b in codes) {
                if (a != b && b.startsWith(a)) violations += "$a is a prefix of $b"
            }
        }
        assertTrue(violations.isEmpty(), "接頭辞符号が壊れている: $violations")
    }

    @Test
    fun `国番号はすべて数字1〜3桁`() {
        for (code in CountryCodes.allCodes()) {
            assertTrue(code.length in 1..3 && code.all { it.isDigit() }, "不正な国番号: $code")
        }
    }

    @Test
    fun `最長一致で国番号を取り出す`() {
        assertEquals("1", CountryCodes.extract("12025550143"))
        assertEquals("81", CountryCodes.extract("819012345678"))
        assertEquals("852", CountryCodes.extract("85212345678"))
        assertEquals("86", CountryCodes.extract("8613800138000"))
        assertEquals("44", CountryCodes.extract("442071234567"))
        assertEquals("7", CountryCodes.extract("74951234567"))
    }

    @Test
    fun `未割当の番号帯は null`() {
        assertNull(CountryCodes.extract("999999999"))
        assertNull(CountryCodes.extract(""))
    }

    @Test
    fun `日英の名前が引ける`() {
        assertEquals("日本", CountryCodes.nameJa("81"))
        assertEquals("Japan", CountryCodes.nameEn("81"))
        assertEquals("アメリカ・カナダ / USA / Canada", CountryCodes.label("1"))
        assertEquals("不明 / Unknown", CountryCodes.label(null))
        assertEquals("+999", CountryCodes.label("999"))
    }

    @Test
    fun `主要国が網羅されている`() {
        for (code in listOf("1", "7", "20", "27", "33", "39", "44", "49", "61", "65", "81", "82", "86", "886", "91")) {
            assertNotNull(CountryCodes.nameJa(code), "国番号 $code が欠けている")
        }
        assertTrue(CountryCodes.size >= 200, "国番号の登録数が少なすぎる: ${CountryCodes.size}")
    }
}
