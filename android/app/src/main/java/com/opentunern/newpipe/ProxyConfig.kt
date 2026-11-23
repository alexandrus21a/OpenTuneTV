package com.opentunern.newpipe

import com.opentunern.BuildConfig
import java.io.IOException
import java.net.Authenticator
import java.net.InetSocketAddress
import java.net.PasswordAuthentication
import java.net.Proxy
import java.net.ProxySelector
import java.net.SocketAddress
import java.net.URI
import okhttp3.OkHttpClient

/**
 * DEV-ONLY workaround: this cloud dev host's IP is blocked by YouTube
 * ("Sign in to confirm you're not a bot" on the player endpoint, HTTP
 * 403 on the signed googlevideo.com CDN URLs it returns) — so during
 * development, YouTube-bound traffic is routed through a residential-
 * style SOCKS5 proxy. A real install runs on the end user's own TV, on
 * their own (normally residential) IP, and needs no proxy at all — this
 * must never activate in a release build, hence every entry point here
 * is gated on [BuildConfig.DEBUG].
 *
 * Uses an explicit [ProxySelector] (not the `socksProxyHost` system
 * properties) so localhost/Metro-dev-server traffic is excluded by
 * code, not by a nonProxyHosts string-matching quirk that turned out
 * not to reliably exempt 127.0.0.1 and broke the Metro connection.
 */
object ProxyConfig {
    private const val HOST = "82.148.246.47"
    private const val PORT = 1080
    private const val USER = "Alex"
    private const val PASS = "ahevueviw12"

    private val proxy = Proxy(Proxy.Type.SOCKS, InetSocketAddress(HOST, PORT))
    private val LOCAL_HOSTS = setOf("127.0.0.1", "localhost", "10.0.2.2", "::1")

    /** Installs a process-wide ProxySelector/Authenticator. Call once, as early as possible — no-op on release builds. */
    fun installDevProxyIfDebug() {
        if (!BuildConfig.DEBUG) return
        Authenticator.setDefault(object : Authenticator() {
            override fun getPasswordAuthentication(): PasswordAuthentication =
                PasswordAuthentication(USER, PASS.toCharArray())
        })
        ProxySelector.setDefault(object : ProxySelector() {
            override fun select(uri: URI): List<Proxy> =
                if (uri.host in LOCAL_HOSTS) listOf(Proxy.NO_PROXY) else listOf(proxy)

            override fun connectFailed(uri: URI, sa: SocketAddress, ioe: IOException) {}
        })
    }

    /** Explicit per-client proxy for code that builds its own OkHttpClient — no-op (returns builder unchanged) on release builds. */
    fun applyTo(builder: OkHttpClient.Builder): OkHttpClient.Builder =
        if (BuildConfig.DEBUG) builder.proxy(proxy) else builder
}
