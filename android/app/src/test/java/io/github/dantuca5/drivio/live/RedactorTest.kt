package io.github.dantuca5.drivio.live

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

// Toate exemplele sunt inventate; formatul imită ofertele Uber și Bolt.
class RedactorTest {
    private val h = Redactor.HIDDEN

    private fun r(s: String) = Redactor.redact(s)

    @Test
    fun adresele_se_ascund() {
        assertEquals(h, r("DJ123B 45, Satu Inventat"))
        assertEquals(h, r("Strada Exemplu 33, Timișoara"))
        assertEquals(h, r("Bd. Unirii 5"))
        assertEquals(h, r("Piața Victoriei"))
        assertEquals(h, r("Gara de Nord"))
        assertEquals(h, r("Cartier Nou 12, Orășelul Mic"))
    }

    @Test
    fun numele_se_ascunde_ratingul_ramane() {
        assertEquals("$h • 5.0", r("Mirela • 5.0"))
        assertEquals(h, r("Mirela"))
        assertEquals("4.95 ★", r("4.95 ★"))
    }

    @Test
    fun telefoanele_si_emailurile_se_ascund() {
        assertEquals(h, r("0722 123 456"))
        assertEquals(h, r("+40 722 123 456"))
        assertEquals("Sună la $h", r("Sună la 0722-123-456"))
        assertEquals("Scrie la $h", r("Scrie la exemplu@mail.ro"))
    }

    @Test
    fun sumele_distantele_si_etichetele_raman() {
        for (s in listOf(
            "lei 15.43 (NET, tax included)",
            "22 mins (17.5 km) away",
            "6 mins (4.1 km) trip",
            "7 min • 2.9 km",
            "RON47.06",
            "39,87 RON",
            "Net of service fee",
            "Accept next ride",
            "Current dropoff",
            "Confirm",
            "Match",
            "UberX",
            "Comfort",
        )) {
            assertEquals(s, r(s))
        }
    }

    @Test
    fun textul_pe_mai_multe_randuri_se_verifica_rand_cu_rand() {
        assertEquals("lei 12.80\n$h", r("lei 12.80\nStrada Exemplu 1, Oraș"))
        assertNull(Redactor.redact(null))
    }
}

class SnapshotTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun jsonul_e_valid_si_scapa_caracterele() {
        val n = ScreenNode("a \"b\"\n", null, "id/x", "android.widget.TextView", 1, 2, 3, 4)
        assertEquals(
            "{\"t\":5,\"pkg\":\"p\",\"n\":[{\"x\":\"a \\\"b\\\"\\n\",\"id\":\"id/x\",\"c\":\"TextView\",\"b\":[1,2,3,4]}]}",
            Snapshot.toJsonLine("p", 5, listOf(n)),
        )
    }

    @Test
    fun amprenta_ignora_pozitia_si_vede_textul() {
        val a = listOf(ScreenNode("lei 9", null, null, null, 0, 0, 1, 1))
        val b = listOf(ScreenNode("lei 9", null, null, null, 5, 5, 9, 9))
        val c = listOf(ScreenNode("lei 10", null, null, null, 0, 0, 1, 1))
        assertEquals(Snapshot.signature(a), Snapshot.signature(b))
        assertTrue(Snapshot.signature(a) != Snapshot.signature(c))
    }

    @Test
    fun cel_mult_o_inregistrare_pe_secunda() {
        assertEquals(300L, Throttle.delayMs(now = 10_000, lastCaptureAt = 0))
        assertEquals(800L, Throttle.delayMs(now = 10_200, lastCaptureAt = 10_000))
    }

    @Test
    fun stocarea_nu_trece_de_limita_si_sterge_intai_ce_e_vechi() {
        val store = CaptureStore(tmp.newFolder("c"), maxBytes = 1_000)
        val line = "x".repeat(59) // 60 de octeți cu linia nouă
        val hour = 3_600_000L
        repeat(10) { store.append(line, 0) }
        repeat(10) { store.append(line, hour) }
        val s = store.stats()
        assertTrue(s.bytes <= 1_000)
        assertEquals(1, s.files) // ora cea veche a fost ștearsă întreagă
        assertEquals(10, s.snapshots)
        store.clear()
        assertEquals(0, store.stats().snapshots)
        assertFalse(store.files().isNotEmpty())
    }
}
