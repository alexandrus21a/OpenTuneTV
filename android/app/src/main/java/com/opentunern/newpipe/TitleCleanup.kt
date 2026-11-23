package com.opentunern.newpipe

/** Ported from com.opentune.catalog.TitleCleanup (same project). */
private val NOISE_SUFFIXES = listOf(
    "official music video",
    "official video",
    "official audio",
    "official lyric video",
    "lyric video",
    "lyrics video",
    "visualizer",
    "audio",
    "video",
    "lyrics",
)

fun String.cleanTrackTitle(): String {
    var cleaned = trim()
    var strippedAny: Boolean
    do {
        strippedAny = false
        val withoutTrailingBracket = cleaned.trimEnd().let {
            if (it.endsWith(")") || it.endsWith("]")) it.dropLast(1) else it
        }
        val openIndex = maxOf(withoutTrailingBracket.lastIndexOf('('), withoutTrailingBracket.lastIndexOf('['))
        if (openIndex >= 0) {
            val inner = withoutTrailingBracket.substring(openIndex + 1).trim().lowercase()
            if (NOISE_SUFFIXES.any { it == inner }) {
                val next = withoutTrailingBracket.substring(0, openIndex).trim()
                if (next.isNotBlank()) {
                    cleaned = next
                    strippedAny = true
                }
            }
        }
    } while (strippedAny)
    return cleaned.ifBlank { trim() }
}
