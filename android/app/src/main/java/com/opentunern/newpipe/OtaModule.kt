package com.opentunern.newpipe

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * In-app OTA updates for a sideloaded (non-Play-Store) TV app: fetch a
 * small JSON manifest, compare against this build's versionCode, and
 * if newer, download the APK and hand it to the system installer.
 * Mirrors the F-Droid/GitHub-Releases self-update pattern used by most
 * sideloaded Android TV apps, since there's no store to push updates
 * through.
 *
 * Manifest shape (host this file + the APK anywhere static — a repo's
 * GitHub raw URL, S3, your own domain):
 *   { "versionCode": 2, "versionName": "1.1", "apkUrl": "https://.../app-release.apk", "notes": "..." }
 */
class OtaModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "OtaModule"

    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private val client = OkHttpClient()

    /** JSON string {versionCode,versionName,apkUrl,notes} if a newer build exists, else null. */
    @ReactMethod
    fun checkForUpdate(manifestUrl: String, promise: Promise) {
        scope.launch {
            runCatching {
                val body = withContext(Dispatchers.IO) {
                    client.newCall(Request.Builder().url(manifestUrl).build()).execute().use { resp ->
                        if (!resp.isSuccessful) error("manifest fetch failed: HTTP ${resp.code}")
                        resp.body?.string() ?: error("empty manifest body")
                    }
                }
                val manifest = JSONObject(body)
                val remoteVersionCode = manifest.getInt("versionCode")
                val currentVersionCode = reactApplicationContext.packageManager
                    .getPackageInfo(reactApplicationContext.packageName, 0).let {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) it.longVersionCode.toInt() else @Suppress("DEPRECATION") it.versionCode
                    }
                if (remoteVersionCode <= currentVersionCode) null else manifest.toString()
            }.fold(
                onSuccess = { promise.resolve(it) },
                onFailure = { promise.reject("ota_check_failed", it.message, it) },
            )
        }
    }

    /** Downloads [apkUrl] to the app cache dir, emitting "ota_progress" {fraction} events as it goes. */
    @ReactMethod
    fun downloadUpdate(apkUrl: String, promise: Promise) {
        scope.launch {
            runCatching {
                val dir = File(reactApplicationContext.cacheDir, "ota").apply { mkdirs() }
                val file = File(dir, "update.apk")
                withContext(Dispatchers.IO) {
                    client.newCall(Request.Builder().url(apkUrl).build()).execute().use { resp ->
                        if (!resp.isSuccessful) error("apk download failed: HTTP ${resp.code}")
                        val body = resp.body ?: error("empty apk body")
                        val total = body.contentLength()
                        var written = 0L
                        body.byteStream().use { input ->
                            FileOutputStream(file).use { output ->
                                val buffer = ByteArray(64 * 1024)
                                while (true) {
                                    val read = input.read(buffer)
                                    if (read == -1) break
                                    output.write(buffer, 0, read)
                                    written += read
                                    if (total > 0) emitProgress(written.toDouble() / total)
                                }
                            }
                        }
                    }
                }
                file.absolutePath
            }.fold(
                onSuccess = { promise.resolve(it) },
                onFailure = { promise.reject("ota_download_failed", it.message, it) },
            )
        }
    }

    private fun emitProgress(fraction: Double) {
        val params = Arguments.createMap().apply { putDouble("fraction", fraction) }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("ota_progress", params)
    }

    /** True if this app is allowed to install APKs it downloads itself (Android 8+ per-app grant). */
    @ReactMethod
    fun canInstallUpdates(promise: Promise) {
        val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            reactApplicationContext.packageManager.canRequestPackageInstalls()
        promise.resolve(allowed)
    }

    /** Sends the user to the system "allow installs from this app" screen (Android 8+ only). */
    @ReactMethod
    fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
            data = Uri.parse("package:${reactApplicationContext.packageName}")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }

    /** Launches the system package installer for the APK previously saved by [downloadUpdate]. */
    @ReactMethod
    fun installUpdate(apkPath: String, promise: Promise) {
        runCatching {
            val file = File(apkPath)
            val uri = FileProvider.getUriForFile(
                reactApplicationContext,
                "${reactApplicationContext.packageName}.ota.fileprovider",
                file,
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val activity: Activity? = reactApplicationContext.currentActivity
            (activity ?: reactApplicationContext).startActivity(intent)
        }.fold(
            onSuccess = { promise.resolve(true) },
            onFailure = { promise.reject("ota_install_failed", it.message, it) },
        )
    }
}
