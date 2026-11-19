package io.github.dantuca5.drivio.live

/**
 * Ascunde datele personale din textul de pe ecran ÎNAINTE să fie scris pe disc:
 * telefoane, e-mailuri, adrese, nume de pasageri și de locuri.
 * Sumele, distanțele, duratele și etichetele aplicației rămân, fiindcă din ele scriem parserii.
 * Regula e prudentă: la îndoială, textul se ascunde.
 */
object Redactor {
    const val HIDDEN = "[ascuns]"

    private val phone = Regex("""(?<!\d)(?:\+?40[\s.-]?|0)7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d)""")
    private val email = Regex("""[\w.+-]+@[\w-]+\.[\w.-]+""")

    private val streetWord = Regex(
        """(?iu)(?<!\p{L})(str|strada|bd|b-dul|bulevardul|calea|aleea|pia[țţt]a|[șşs]os|[șşs]oseaua|splaiul|intrarea|drumul|nr|jude[țţt]ul|jud|sector|sectorul|comuna|street|avenue|road)(?!\p{L})""",
    )
    private val roadCode = Regex("""(?<![\p{L}\d])(DN|DJ|DC)\d{1,4}[A-Z]?(?![\p{L}\d])""")
    private val numberCommaPlace = Regex("""\d+[A-Za-z]?\s*,\s*\p{Lu}""")
    private val postalCode = Regex("""(?<!\d)\d{6}(?!\d)""")

    /** „Mirela • 5.0”: numele se ascunde, ratingul rămâne. */
    private val nameWithRating = Regex("""^(\p{L}[\p{L}\p{M}'. -]{0,40}?)\s*([•·★⭐])\s*(\d[.,]\d{1,2})$""")

    /** 1–5 cuvinte cu majusculă, fără cifre: nume de persoane sau de locuri. */
    private val titleCase = Regex(
        """^\p{Lu}[\p{Ll}\p{M}'.-]+(?:\s+(?:\p{Lu}[\p{Ll}\p{M}'.-]+|de|din|la|lui|cu|și|si|of|the|al|a)){0,4}$""",
    )

    /** Etichete din aplicațiile Uber și Bolt care arată ca un nume, dar nu sunt. */
    private val uiWords = setOf(
        "uber", "bolt", "comfort", "economy", "exclusive", "premium", "business", "green", "electric", "pet", "delivery", "courier",
        "confirm", "match", "accept", "decline", "reject", "dismiss", "navigate", "cancel", "arrived", "start", "complete", "finish",
        "ride", "rides", "trip", "trips", "pickup", "dropoff", "earnings", "home", "menu", "settings", "close", "back", "next", "skip",
        "ok", "cash", "card", "online", "offline", "go", "stop", "wait", "waiting", "rating", "help", "support", "chat", "call",
        "acceptă", "confirmă", "respinge", "refuză", "anulează", "numerar", "cursă", "curse", "preluare", "destinație", "începe",
        "finalizează", "câștiguri", "acasă", "meniu", "setări", "înapoi", "închide", "ajutor", "apel", "mesaj", "plată",
    )

    fun redact(text: String?): String? {
        if (text == null) return null
        return text.split('\n').joinToString("\n") { redactLine(it) }
    }

    private fun redactLine(original: String): String {
        val line = original.trim()
        if (line.isEmpty()) return original
        if (looksLikeAddress(line)) return HIDDEN
        var out = phone.replace(line, HIDDEN)
        out = email.replace(out, HIDDEN)
        nameWithRating.matchEntire(out)?.let { m ->
            if (!isUiLabel(m.groupValues[1])) return "$HIDDEN ${m.groupValues[2]} ${m.groupValues[3]}"
        }
        if (titleCase.matches(out) && !isUiLabel(out)) return HIDDEN
        return out
    }

    private fun looksLikeAddress(s: String): Boolean =
        streetWord.containsMatchIn(s) || roadCode.containsMatchIn(s) || numberCommaPlace.containsMatchIn(s) || postalCode.containsMatchIn(s)

    private fun isUiLabel(s: String): Boolean = s.trim().lowercase() in uiWords
}
