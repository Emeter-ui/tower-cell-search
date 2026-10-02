package com.scantowercell

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var bridge: NativeBridge

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            // Push an event to the PWA so it can refresh its view of permissions.
            webView.post {
                webView.evaluateJavascript(
                    "window.__cellBridgeEvent && window.__cellBridgeEvent('{}');",
                    null
                )
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Chromium rejects ES-module script loads from file:// origins, which
        // is what the Vite-built PWA uses. Serve the bundle instead from a
        // virtual https origin backed by the APK's assets directory.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = false
                mediaPlaybackRequiresUserGesture = false
                setSupportZoom(false)
            }
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest,
                ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)
            }
            setBackgroundColor(0xff0b1220.toInt())
        }

        bridge = NativeBridge(
            app = application,
            webView = webView,
            onRequestPermissions = {
                permissionLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.READ_PHONE_STATE,
                    )
                )
            },
            hasPermission = ::hasPermission,
        )
        webView.addJavascriptInterface(bridge, "AndroidCellBridge")

        setContentView(webView)

        // Load the PWA via the virtual https origin served by WebViewAssetLoader.
        webView.loadUrl("https://appassets.androidplatform.net/assets/pwa/index.html")
    }

    override fun onDestroy() {
        bridge.shutdown()
        super.onDestroy()
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
}
