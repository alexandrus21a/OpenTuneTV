package com.opentunern.newpipe

import org.json.JSONArray
import org.json.JSONObject
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.StreamInfoItem

/**
 * JS-facing track shape — mirrors com.opentune.model.Track from the
 * Compose app, serialized to JSON for the RN bridge.
 */
data class RnTrack(
    val id: String,
    val title: String,
    val artist: String,
    val artworkUrl: String,
    val durationSeconds: Int,
    val canvasYoutubeVideoId: String? = null,
    val mixPlaylistId: String? = null,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("title", title)
        put("artist", artist)
        put("artworkUrl", artworkUrl)
        put("durationSeconds", durationSeconds)
        put("canvasYoutubeVideoId", canvasYoutubeVideoId)
        put("mixPlaylistId", mixPlaylistId)
    }
}

data class RnShelf(val id: String, val title: String, val tracks: List<RnTrack>) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("title", title)
        put("tracks", JSONArray(tracks.map { it.toJson() }))
    }
}

/**
 * Ported from com.opentune.catalog.YouTubeCatalogRepository (same
 * project) — see that file's doc comment for the full design rationale
 * (signed-out Innertube Home browse, NewPipeExtractor search fallback).
 */
object CatalogRepository {
    private const val TRACKS_PER_SHELF = 12
    private const val MIX_QUEUE_LIMIT = 50
    private const val SEARCH_RESULT_LIMIT = 30

    fun loadShelves(): List<RnShelf> {
        val home = runCatching { homeShelves() }.getOrElse { emptyList() }
        return home.ifEmpty { searchShelves() }
    }

    fun resolveMixQueue(playlistId: String): List<RnTrack> = runCatching {
        val response = Innertube.next(playlistId)
        InnertubeParser.parseMixTracks(response, limit = MIX_QUEUE_LIMIT).mapNotNull { it.toTrackOrNull() }
    }.getOrElse { emptyList() }

    private fun homeShelves(): List<RnShelf> {
        val response = Innertube.browse("FEmusic_home")
        val shelves = InnertubeParser.parseHome(response)
        return shelves.mapIndexedNotNull { index, shelf -> shelfOf("home_$index", shelf.title, shelf.items) }
    }

    private fun shelfOf(id: String, title: String, items: List<ShelfItem>): RnShelf? {
        val tracks = items.mapNotNull { it.toTrackOrNull() ?: it.toMixCardOrNull() }.take(TRACKS_PER_SHELF)
        return if (tracks.isEmpty()) null else RnShelf(id = id, title = title, tracks = tracks)
    }

    private fun ShelfItem.toTrackOrNull(): RnTrack? {
        val videoId = videoId ?: return null
        val artwork = thumbnailUrl ?: return null
        return RnTrack(
            id = videoId,
            title = title.cleanTrackTitle(),
            artist = InnertubeParser.artistFromSubtitle(subtitle).ifBlank { "YouTube Music" },
            artworkUrl = artwork,
            durationSeconds = 0,
            canvasYoutubeVideoId = videoId,
        )
    }

    private fun ShelfItem.toMixCardOrNull(): RnTrack? {
        val browseId = browseId ?: return null
        val playlistId = browseId.removePrefix("VL").takeIf { it.startsWith("RD") } ?: return null
        val artwork = thumbnailUrl ?: return null
        return RnTrack(
            id = playlistId,
            title = title.cleanTrackTitle(),
            artist = subtitle.ifBlank { "Mix" },
            artworkUrl = artwork,
            durationSeconds = 0,
            mixPlaylistId = playlistId,
        )
    }

    // ---- Fallback: search-query shelves via NewPipeExtractor -----------

    private data class ShelfQuery(val id: String, val title: String, val query: String)

    private val shelfQueries = listOf(
        ShelfQuery("daily_mix", "Daily Mix", "music mix 2025"),
        ShelfQuery("trending", "Trending Now", "trending music video"),
        ShelfQuery("chill", "Chill & Lofi", "lofi chill beats"),
        ShelfQuery("recent", "New Releases", "new music release 2025"),
    )

    private fun searchShelves(): List<RnShelf> {
        NewPipeBootstrap.ensureInit()
        return shelfQueries
            .map { shelfQuery ->
                val tracks = runCatching { search(shelfQuery.query) }.getOrElse { emptyList() }
                RnShelf(id = shelfQuery.id, title = shelfQuery.title, tracks = tracks)
            }
            .filter { it.tracks.isNotEmpty() }
    }

    /**
     * Free-text search (artist/track name) — for the Search screen.
     * Tries YouTube Music's own search first (real song metadata, square
     * album art, via Innertube's "Songs" shelf — see
     * [InnertubeParser.parseSearchSongs]), which is what makes the
     * difference between a clean track list and a pile of random
     * uploaded videos. Falls back to NewPipeExtractor's plain YouTube
     * video search only if that comes back empty.
     */
    fun searchTracks(query: String): List<RnTrack> {
        val musicResults = runCatching {
            val response = Innertube.search(query)
            InnertubeParser.parseSearchSongs(response, limit = SEARCH_RESULT_LIMIT).mapNotNull { it.toTrackOrNull() }
        }.getOrElse {
            android.util.Log.w("CatalogRepository", "Innertube music search failed for '$query': ${it.javaClass.simpleName}: ${it.message}")
            emptyList()
        }
        android.util.Log.w("CatalogRepository", "Innertube music search for '$query': ${musicResults.size} songs")
        if (musicResults.isNotEmpty()) return musicResults

        return runCatching {
            NewPipeBootstrap.ensureInit()
            search(query, limit = SEARCH_RESULT_LIMIT)
        }.getOrElse { emptyList() }
    }

    private fun search(query: String, limit: Int = TRACKS_PER_SHELF): List<RnTrack> {
        val extractor = ServiceList.YouTube.getSearchExtractor(query)
        extractor.fetchPage()
        return extractor.initialPage.items
            .filterIsInstance<StreamInfoItem>()
            .filter { it.duration > 0 }
            .take(limit)
            .mapNotNull { it.toTrackOrNull() }
    }

    private fun StreamInfoItem.toTrackOrNull(): RnTrack? {
        val videoId = extractVideoId(url) ?: return null
        val artwork = thumbnails.maxByOrNull { it.height }?.url
            ?: thumbnails.firstOrNull()?.url
            ?: return null
        return RnTrack(
            id = videoId,
            title = name.cleanTrackTitle(),
            artist = uploaderName ?: "Unknown artist",
            artworkUrl = artwork,
            durationSeconds = duration.toInt().coerceAtLeast(0),
            canvasYoutubeVideoId = videoId,
        )
    }

    private fun extractVideoId(url: String): String? =
        Regex("[?&]v=([^&]+)").find(url)?.groupValues?.get(1)
            ?: url.substringAfterLast("/").takeIf { it.isNotBlank() && !it.contains("=") }
}
