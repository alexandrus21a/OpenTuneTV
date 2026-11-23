package com.opentunern.newpipe

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Minimal, unauthenticated Innertube (youtubei) client for YouTube Music's
 * WEB_REMIX `browse` endpoint. Ported from the Compose app
 * (com.opentune.innertube.Innertube), itself adapted from
 * github.com/justshivv/Opentune (GPL-3.0).
 */
object Innertube {
    private const val MUSIC_BASE = "https://music.youtube.com/youtubei/v1"
    private const val MUSIC_ORIGIN = "https://music.youtube.com"

    private const val WEB_REMIX_VERSION = "1.20250101.01.00"
    private const val WEB_REMIX_CLIENT_ID = "67"
    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

    private val client = ProxyConfig.applyTo(
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS),
    ).build()

    private val validCountries: Set<String> by lazy { Locale.getISOCountries().toSet() }

    private val region: String
        get() {
            val country = Locale.getDefault().country.uppercase(Locale.ROOT)
            return country.takeIf { it in validCountries } ?: "US"
        }

    private val language: String
        get() = Locale.getDefault().language.ifEmpty { "en" }

    fun browse(browseId: String, params: String? = null): JSONObject = post("browse") {
        put("browseId", browseId)
        params?.let { put("params", it) }
    }

    fun next(playlistId: String): JSONObject = post("next") {
        put("playlistId", playlistId)
        put("isAudioOnly", true)
    }

    /**
     * Unauthenticated YouTube Music search — mixed shelves (Top result,
     * Songs, Videos, Albums, Artists...). [InnertubeParser.parseSearchSongs]
     * pulls just the "Songs" shelf out of it, which carries real song
     * metadata and square album art, unlike a plain YouTube video search.
     */
    fun search(query: String): JSONObject = post("search") {
        put("query", query)
    }

    private fun post(endpoint: String, body: JSONObject.() -> Unit): JSONObject {
        val payload = JSONObject().apply {
            put(
                "context",
                JSONObject().apply {
                    put(
                        "client",
                        JSONObject().apply {
                            put("clientName", "WEB_REMIX")
                            put("clientVersion", WEB_REMIX_VERSION)
                            put("hl", language)
                            put("gl", region)
                        },
                    )
                    put("user", JSONObject().put("lockedSafetyMode", false))
                },
            )
            body()
        }
        val separator = if (endpoint.contains('?')) "&" else "?"
        val request = Request.Builder()
            .url("$MUSIC_BASE/$endpoint${separator}prettyPrint=false")
            .header("Origin", MUSIC_ORIGIN)
            .header("Referer", "$MUSIC_ORIGIN/")
            .header("X-Origin", MUSIC_ORIGIN)
            .header("X-YouTube-Client-Name", WEB_REMIX_CLIENT_ID)
            .header("X-YouTube-Client-Version", WEB_REMIX_VERSION)
            .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            check(response.isSuccessful) { "Innertube browse failed: HTTP ${response.code}: ${text.take(300)}" }
            return JSONObject(text)
        }
    }
}
