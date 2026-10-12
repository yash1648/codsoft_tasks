package com.quoteapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {
    override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<com.facebook.react.ReactPackage> =
            PackageList(this).packages
        override fun getJSMainModuleName(): String = "index"
        override val isNewArchEnabled: Boolean = DefaultNewArchitectureEntryPoint.getFabricEnabled()
        override val isOldArchEnabled: Boolean = DefaultNewArchitectureEntryPoint.getFacadesEnabled()
    }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
    }
}
