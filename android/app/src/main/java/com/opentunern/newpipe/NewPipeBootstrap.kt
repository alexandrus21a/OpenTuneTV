package com.opentunern.newpipe

import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.OkHttpClient
import org.schabi.newpipe.extractor.NewPipe

/**
 * [NewPipe.init] is a process-wide singleton call — every feature that
 * talks to YouTube through NewPipeExtractor must share this one call.
 */
object NewPipeBootstrap {
    private val initialized = AtomicBoolean(false)
    private val client by lazy { ProxyConfig.applyTo(OkHttpClient.Builder()).build() }

    fun ensureInit() {
        if (initialized.compareAndSet(false, true)) {
            NewPipe.init(OkHttpDownloader(client))
        }
    }
}
