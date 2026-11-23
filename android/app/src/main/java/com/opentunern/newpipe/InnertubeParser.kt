package com.opentunern.newpipe

import org.json.JSONArray
import org.json.JSONObject

/**
 * Ported from com.opentune.innertube.InnertubeParser (same project) — see
 * that file's doc comment for provenance (github.com/justshivv/Opentune,
 * GPL-3.0).
 */
object InnertubeParser {

    fun parseHome(response: JSONObject): List<HomeShelf> {
        val sections = response.obj("contents")
            .obj("singleColumnBrowseResultsRenderer").arr("tabs")?.optJSONObject(0)
            .obj("tabRenderer").obj("content").obj("sectionListRenderer").arr("contents")
            ?: return emptyList()
        val shelves = mutableListOf<HomeShelf>()
        for (i in 0 until sections.length()) {
            val section = sections.optJSONObject(i) ?: continue
            section.optJSONObject("musicCarouselShelfRenderer")?.let(::carouselShelf)?.let(shelves::add)
            section.optJSONObject("musicShelfRenderer")?.let(::plainShelf)?.let(shelves::add)
        }
        return shelves
    }

    private fun carouselShelf(carousel: JSONObject): HomeShelf? {
        val header = carousel.obj("header").obj("musicCarouselShelfBasicHeaderRenderer")
        val title = header.obj("title").runs()
        val strapline = header.obj("strapline").runs()
        if (VIDEO_WORD.containsMatchIn(title)) return null
        val contents = carousel.arr("contents") ?: return null
        val items = mutableListOf<ShelfItem>()
        for (i in 0 until contents.length()) {
            val item = contents.optJSONObject(i) ?: continue
            parseTwoRowItem(item.optJSONObject("musicTwoRowItemRenderer"))?.let(items::add)
        }
        return if (items.isEmpty()) null else HomeShelf(title.ifBlank { "For you" }, items, strapline)
    }

    private fun plainShelf(shelf: JSONObject): HomeShelf? {
        val title = shelf.obj("title").runs()
        if (VIDEO_WORD.containsMatchIn(title)) return null
        val contents = shelf.arr("contents") ?: return null
        val items = mutableListOf<ShelfItem>()
        for (i in 0 until contents.length()) {
            val item = contents.optJSONObject(i) ?: continue
            parseResponsiveListItem(item.optJSONObject("musicResponsiveListItemRenderer"))?.let(items::add)
        }
        return if (items.isEmpty()) null else HomeShelf(title.ifBlank { "For you" }, items)
    }

    private fun parseTwoRowItem(renderer: JSONObject?): ShelfItem? {
        renderer ?: return null
        val title = renderer.obj("title").runs()
        if (title.isBlank()) return null
        val endpoint = renderer.obj("navigationEndpoint")
        val browseId = endpoint.obj("browseEndpoint").str("browseId")
        val videoId = endpoint.obj("watchEndpoint").str("videoId")
            ?: browseId?.takeIf { it.startsWith("MPED") }?.removePrefix("MPED")
        val resolvedBrowseId = browseId?.takeUnless { it.startsWith("MPED") }
        val thumbnails = renderer.obj("thumbnailRenderer").obj("musicThumbnailRenderer")
            .obj("thumbnail").arr("thumbnails")
        val subtitle = renderer.obj("subtitle").runs()
        if (resolvedBrowseId == null && videoId != null && thumbnails.isNotSquare()) return null
        if (resolvedBrowseId != null &&
            !resolvedBrowseId.startsWith("VL") && !resolvedBrowseId.startsWith("PL") &&
            !resolvedBrowseId.startsWith("MPRE") && !resolvedBrowseId.startsWith("UC") &&
            (VIDEO_WORD.containsMatchIn(title) || VIDEO_WORD.containsMatchIn(subtitle))
        ) {
            return null
        }
        return ShelfItem(title, subtitle, thumbnails.best(), videoId, resolvedBrowseId)
    }

    private fun parseResponsiveListItem(renderer: JSONObject?): ShelfItem? {
        renderer ?: return null
        val videoId = renderer.obj("playlistItemData").str("videoId")
            ?: renderer.obj("overlay").obj("musicItemThumbnailOverlayRenderer").obj("content")
                .obj("musicPlayButtonRenderer").obj("playNavigationEndpoint")
                .obj("watchEndpoint").str("videoId")
            ?: return null
        val columns = renderer.arr("flexColumns") ?: return null
        val title = columns.optJSONObject(0)
            .obj("musicResponsiveListItemFlexColumnRenderer").obj("text").runs()
        if (title.isBlank()) return null
        val subtitle = columns.optJSONObject(1)
            .obj("musicResponsiveListItemFlexColumnRenderer").obj("text").runs()
        val thumbnails = renderer.obj("thumbnail").obj("musicThumbnailRenderer")
            .obj("thumbnail").arr("thumbnails")
        if (thumbnails.isNotSquare()) return null
        return ShelfItem(title, subtitle, thumbnails.best(), videoId, null)
    }

    /**
     * Every `musicResponsiveListItemRenderer` found anywhere in an
     * unauthenticated [Innertube.search] response — walked out instead
     * of pinned to a fixed `contents.tabbedSearchResultsRenderer...`
     * path, because the signed-out search response's envelope shape
     * (whether results sit under a tab wrapper or straight under
     * `sectionListRenderer`) isn't worth hard-coding, same tradeoff as
     * [parseHomeContinuation]/[parseMixTracks]. [parseResponsiveListItem]
     * already rejects widescreen (video-upload) thumbnails, which is
     * what keeps this a song list instead of a pile of random uploads.
     */
    fun parseSearchSongs(response: JSONObject, limit: Int = 30): List<ShelfItem> {
        val out = mutableListOf<ShelfItem>()
        fun walk(node: Any?) {
            if (out.size >= limit) return
            when (node) {
                is JSONObject -> {
                    node.optJSONObject("musicResponsiveListItemRenderer")?.let(::parseResponsiveListItem)?.let(out::add)
                    if (out.size >= limit) return
                    node.keys().forEach { key -> walk(node.opt(key)) }
                }
                is JSONArray -> for (i in 0 until node.length()) { if (out.size >= limit) return; walk(node.opt(i)) }
            }
        }
        walk(response)
        return out
    }

    fun parseMixTracks(response: JSONObject, limit: Int = 12): List<ShelfItem> {
        val out = mutableListOf<ShelfItem>()
        fun walk(node: Any?) {
            if (out.size >= limit) return
            when (node) {
                is JSONObject -> {
                    node.optJSONObject("playlistPanelVideoRenderer")?.let(::watchSong)?.let(out::add)
                    if (out.size >= limit) return
                    node.keys().forEach { key -> walk(node.opt(key)) }
                }
                is JSONArray -> for (i in 0 until node.length()) { if (out.size >= limit) return; walk(node.opt(i)) }
            }
        }
        walk(response)
        return out
    }

    private fun watchSong(renderer: JSONObject): ShelfItem? {
        val videoId = renderer.str("videoId") ?: return null
        val title = renderer.obj("title").runs()
        if (title.isBlank()) return null
        val byline = renderer.obj("longBylineText").runs().ifBlank { renderer.obj("shortBylineText").runs() }
        val artist = byline.substringBefore("•").trim()
        val thumbnails = renderer.obj("thumbnail").arr("thumbnails")
        return ShelfItem(title, artist, thumbnails.best(), videoId, null)
    }

    fun artistFromSubtitle(subtitle: String): String {
        val parts = subtitle.split(" • ").map(String::trim).filter { it.isNotBlank() }
        fun isCredit(part: String) = part.lowercase() !in TYPE_WORDS &&
            !part.matches(DURATION) && !part.matches(TALLY)
        return parts.firstOrNull(::isCredit) ?: subtitle
    }

    private val TYPE_WORDS = setOf(
        "song", "video", "album", "single", "ep", "artist", "playlist", "podcast", "episode",
    )
    private val DURATION = Regex("""\d+:\d{2}""")
    private val TALLY = Regex(
        """[\d.,]+\s*[KMB]?\s+(plays|views|likes|songs|tracks|subscribers|hours?|minutes?|seconds?)\b.*""",
        RegexOption.IGNORE_CASE,
    )
    private val VIDEO_WORD = Regex("""\bvideos?\b""", RegexOption.IGNORE_CASE)
}

private fun JSONObject?.obj(key: String): JSONObject? = this?.optJSONObject(key)
private fun JSONObject?.arr(key: String): JSONArray? = this?.optJSONArray(key)
private fun JSONObject?.str(key: String): String? =
    if (this == null || isNull(key) || !has(key)) null else optString(key)

private fun JSONObject?.runs(): String {
    val runs = this?.optJSONArray("runs") ?: return ""
    val sb = StringBuilder()
    for (i in 0 until runs.length()) sb.append(runs.optJSONObject(i)?.optString("text").orEmpty())
    return sb.toString()
}

private fun JSONArray?.best(): String? {
    val array = this ?: return null
    if (array.length() == 0) return null
    return array.optJSONObject(array.length() - 1)?.optString("url")
}

private fun JSONArray?.isNotSquare(): Boolean {
    val array = this ?: return false
    if (array.length() == 0) return false
    val last = array.optJSONObject(array.length() - 1) ?: return false
    val width = last.optDouble("width", -1.0)
    val height = last.optDouble("height", -1.0)
    if (width <= 0 || height <= 0) return false
    return width / height !in 0.85..1.15
}
