package io.github.dantuca5.drivio.live

/** Un element de pe ecran, așa cum îl vede serviciul de accesibilitate (fără legătură cu Android, deci testabil). */
data class ScreenNode(
    val text: String?,
    val desc: String?,
    val viewId: String?,
    val cls: String?,
    val l: Int,
    val t: Int,
    val r: Int,
    val b: Int,
)

object Snapshot {
    /** Elementele cu datele personale ascunse. */
    fun redacted(nodes: List<ScreenNode>): List<ScreenNode> =
        nodes.map { it.copy(text = Redactor.redact(it.text), desc = Redactor.redact(it.desc)) }

    /** Amprenta textului de pe ecran: dacă nu s-a schimbat, nu salvăm din nou. */
    fun signature(nodes: List<ScreenNode>): Int =
        nodes.joinToString("\u0001") { "${it.text}\u0002${it.desc}" }.hashCode()

    /** O linie JSON: {"t":…,"pkg":"…","n":[{"x":"…","d":"…","id":"…","c":"…","b":[l,t,r,b]}]}. */
    fun toJsonLine(pkg: String, timeMs: Long, nodes: List<ScreenNode>): String {
        val sb = StringBuilder()
        sb.append("{\"t\":").append(timeMs).append(",\"pkg\":").append(quote(pkg)).append(",\"n\":[")
        nodes.forEachIndexed { i, n ->
            if (i > 0) sb.append(',')
            sb.append('{')
            for ((k, v) in listOf("x" to n.text, "d" to n.desc, "id" to n.viewId, "c" to n.cls?.substringAfterLast('.'))) {
                if (v.isNullOrEmpty()) continue
                sb.append(quote(k)).append(':').append(quote(v)).append(',')
            }
            sb.append("\"b\":[").append(n.l).append(',').append(n.t).append(',').append(n.r).append(',').append(n.b).append("]}")
        }
        sb.append("]}")
        return sb.toString()
    }

    fun quote(s: String): String {
        val sb = StringBuilder(s.length + 2).append('"')
        for (ch in s) {
            when {
                ch == '"' -> sb.append("\\\"")
                ch == '\\' -> sb.append("\\\\")
                ch == '\n' -> sb.append("\\n")
                ch == '\r' -> sb.append("\\r")
                ch == '\t' -> sb.append("\\t")
                ch < ' ' -> sb.append(String.format("\\u%04x", ch.code))
                else -> sb.append(ch)
            }
        }
        return sb.append('"').toString()
    }
}

object Throttle {
    /**
     * Cât așteptăm până la următoarea înregistrare: lăsăm ecranul să se așeze (settleMs)
     * și nu salvăm mai des de o dată pe secundă (intervalMs).
     */
    fun delayMs(now: Long, lastCaptureAt: Long, intervalMs: Long = 1000, settleMs: Long = 300): Long =
        maxOf(settleMs, lastCaptureAt + intervalMs - now)
}
