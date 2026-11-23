package com.opentunern

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.opentunern.newpipe.NewPipePackage
import com.opentunern.newpipe.ProxyConfig

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(NewPipePackage())
        },
    )
  }

  override fun onCreate() {
    // DEV-ONLY — see ProxyConfig's doc comment. No-op in release builds.
    ProxyConfig.installDevProxyIfDebug()
    super.onCreate()
    loadReactNative(this)
  }
}
