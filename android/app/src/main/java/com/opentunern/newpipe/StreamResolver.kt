package com.opentunern.newpipe

import org.json.JSONObject
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.VideoStream

/**
 * Resolves playable stream URLs for a YouTube video id via
 * NewPipeExtractor — no API key, no official Data API quota.
 *
 * [resolveAudio] is what actually makes the app play music: the best
 * available audio-only stream for [videoId], handed to react-native-video
 * on the JS side as its source.
 *
 * [resolveCanvas] is ported from com.opentune.youtube.YouTubeCanvasResolver
 * — a small, muted, non-AV1 video-only loop for the Now Playing background.
 */
object StreamResolver {

    private const val TAG = "StreamResolver"

    fun resolveAudio(videoId: String): JSONObject? = runCatching {
        NewPipeBootstrap.ensureInit()
        val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$videoId")
        android.util.Log.w(TAG, "resolveAudio($videoId): ${info.audioStreams.size} audio streams")
        val stream = pickAudioStream(info.audioStreams) ?: return null
        JSONObject().apply {
            put("streamUrl", stream.content)
            put("durationSeconds", info.duration)
            put("mimeType", stream.format?.mimeType ?: "audio/mp4")
        }
    }.onFailure { e ->
        android.util.Log.w(TAG, "resolveAudio($videoId) failed: ${e.javaClass.simpleName}: ${e.message}")
    }.getOrNull()

    fun resolveCanvas(videoId: String, quality: String): JSONObject? = runCatching {
        NewPipeBootstrap.ensureInit()
        val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$videoId")
        val targetHeight = if (quality == "high") 480 else 144
        val stream = pickVideoStream(info.videoOnlyStreams, targetHeight)
            ?: pickVideoStream(info.videoStreams, targetHeight)
            ?: return null
        JSONObject().apply {
            put("streamUrl", stream.content)
            put("durationSeconds", info.duration)
        }
    }.getOrNull()

    /** Highest-bitrate non-video audio stream — quality matters for actual listening. */
    private fun pickAudioStream(streams: List<AudioStream>): AudioStream? = streams
        .maxByOrNull { it.averageBitrate }

    /**
     * Canvas is small on screen and silent — "low" prefers the smallest
     * available stream to minimize data/decode cost; "high" picks the
     * stream closest to [targetHeight] without going far over it, for
     * a noticeably sharper loop on a big TV panel. AV1 is always
     * skipped: it decodes in software on most Android TV boxes.
     */
    private fun pickVideoStream(streams: List<VideoStream>, targetHeight: Int): VideoStream? = streams
        .filter { !it.isAv1() }
        .minByOrNull { kotlin.math.abs(it.heightOrMax() - targetHeight) }

    private fun VideoStream.isAv1(): Boolean {
        val codec = codec.orEmpty()
        return codec.contains("av01", ignoreCase = true) || codec.contains("av1", ignoreCase = true)
    }

    private fun VideoStream.heightOrMax(): Int =
        resolution.orEmpty().takeWhile { it.isDigit() }.toIntOrNull() ?: Int.MAX_VALUE
}
