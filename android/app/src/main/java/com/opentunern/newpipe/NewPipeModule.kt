package com.opentunern.newpipe

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray

/**
 * JS-facing bridge for the YouTube catalog/stream layer. Every method
 * runs on Dispatchers.IO (network + NewPipeExtractor parsing are
 * blocking) and resolves/rejects the JS Promise — nothing here touches
 * the UI thread.
 */
class NewPipeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun getName(): String = "NewPipeModule"

    /** JSON string: [{id,title,tracks:[{id,title,artist,artworkUrl,durationSeconds,canvasYoutubeVideoId,mixPlaylistId}]}] */
    @ReactMethod
    fun loadShelves(promise: Promise) {
        scope.launch {
            runCatching {
                val shelves = CatalogRepository.loadShelves()
                JSONArray(shelves.map { it.toJson() }).toString()
            }.fold(
                onSuccess = { promise.resolve(it) },
                onFailure = { promise.reject("load_shelves_failed", it.message, it) },
            )
        }
    }

    /** JSON string: [{id,title,artist,artworkUrl,durationSeconds,...}] */
    @ReactMethod
    fun resolveMixQueue(playlistId: String, promise: Promise) {
        scope.launch {
            runCatching {
                val tracks = CatalogRepository.resolveMixQueue(playlistId)
                JSONArray(tracks.map { it.toJson() }).toString()
            }.fold(
                onSuccess = { promise.resolve(it) },
                onFailure = { promise.reject("resolve_mix_failed", it.message, it) },
            )
        }
    }

    /** JSON string: [{id,title,artist,artworkUrl,durationSeconds,...}] — free-text search, no account needed. */
    @ReactMethod
    fun searchTracks(query: String, promise: Promise) {
        scope.launch {
            runCatching {
                val tracks = CatalogRepository.searchTracks(query)
                JSONArray(tracks.map { it.toJson() }).toString()
            }.fold(
                onSuccess = { promise.resolve(it) },
                onFailure = { promise.reject("search_failed", it.message, it) },
            )
        }
    }

    /** JSON string {streamUrl,durationSeconds,mimeType} or null if nothing playable was found. */
    @ReactMethod
    fun resolveAudioStream(videoId: String, promise: Promise) {
        scope.launch {
            runCatching { StreamResolver.resolveAudio(videoId)?.toString() }.fold(
                onSuccess = { promise.resolve(it) },
                onFailure = { promise.reject("resolve_audio_failed", it.message, it) },
            )
        }
    }

    /** JSON string {streamUrl,durationSeconds} or null. quality is "low" or "high". */
    @ReactMethod
    fun resolveCanvas(videoId: String, quality: String, promise: Promise) {
        scope.launch {
            runCatching { StreamResolver.resolveCanvas(videoId, quality)?.toString() }.fold(
                onSuccess = { promise.resolve(it) },
                onFailure = { promise.reject("resolve_canvas_failed", it.message, it) },
            )
        }
    }
}
