package io.github.dantuca5.drivio.live

import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Înregistrările de ecran, câte un fișier pe oră, în spațiul privat al aplicației.
 * Totalul nu trece de maxBytes: când se umple, se șterg întâi fișierele cele mai vechi.
 */
class CaptureStore(private val dir: File, private val maxBytes: Long = 5_000_000) {

    data class Stats(val snapshots: Int, val bytes: Long, val files: Int)

    fun append(line: String, nowMs: Long) {
        val bytes = (line + "\n").toByteArray(Charsets.UTF_8)
        if (bytes.size > maxBytes / 10) return // o instantanee uriașă nu e un ecran de ofertă
        dir.mkdirs()
        var list = files()
        var total = list.sumOf { it.length() }
        while (total + bytes.size > maxBytes && list.isNotEmpty()) {
            val oldest = list.first()
            total -= oldest.length()
            oldest.delete()
            list = list.drop(1)
        }
        File(dir, "capturi-${hourKey(nowMs)}.jsonl").appendBytes(bytes)
    }

    fun files(): List<File> =
        dir.listFiles { f -> f.isFile && f.name.endsWith(".jsonl") }?.sortedBy { it.name } ?: emptyList()

    fun stats(): Stats {
        val list = files()
        var lines = 0
        for (f in list) f.forEachBlock { buf, n -> for (i in 0 until n) if (buf[i] == NEWLINE) lines++ }
        return Stats(lines, list.sumOf { it.length() }, list.size)
    }

    /** Toate înregistrările într-un singur fișier, pentru partajare. */
    fun mergeTo(out: File): File {
        out.parentFile?.mkdirs()
        out.outputStream().use { o -> files().forEach { f -> f.inputStream().use { it.copyTo(o) } } }
        return out
    }

    fun clear() {
        files().forEach { it.delete() }
    }

    private fun hourKey(ms: Long): String = SimpleDateFormat("yyyyMMdd-HH", Locale.US).format(Date(ms))

    private companion object {
        const val NEWLINE: Byte = 10
    }
}
