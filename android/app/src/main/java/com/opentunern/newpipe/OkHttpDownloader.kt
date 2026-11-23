package com.opentunern.newpipe

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Response as ExtractorResponse
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException

/**
 * Minimal [Downloader] NewPipeExtractor needs to make HTTP requests.
 * Ported as-is from the Compose app (com.opentune.youtube.OkHttpDownloader).
 */
class OkHttpDownloader(private val client: OkHttpClient) : Downloader() {

    @Throws(java.io.IOException::class, ReCaptchaException::class)
    override fun execute(request: org.schabi.newpipe.extractor.downloader.Request): ExtractorResponse {
        val httpMethod = request.httpMethod()
        val url = request.url()
        val headers = request.headers()
        val dataToSend = request.dataToSend()
        val body = dataToSend?.toRequestBody()

        val builder = Request.Builder()
            .url(url)
            .addHeader("User-Agent", USER_AGENT)
            .method(httpMethod, body)
        headers.forEach { (name, values) ->
            builder.removeHeader(name)
            values.forEach { builder.addHeader(name, it) }
        }

        client.newCall(builder.build()).execute().use { response ->
            if (response.code == 429) {
                throw ReCaptchaException("reCAPTCHA challenge requested", url)
            }
            val bodyString = response.body?.string().orEmpty()
            val latestUrl = response.request.url.toString()
            return ExtractorResponse(
                response.code,
                response.message,
                response.headers.toMultimap(),
                bodyString,
                latestUrl,
            )
        }
    }

    private companion object {
        const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"
    }
}
