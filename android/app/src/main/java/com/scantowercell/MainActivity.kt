package com.scantowercell

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

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
            webViewClient = WebViewClient()
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

        // Load the PWA bundle shipped inside the APK.
        webView.loadUrl("file:///android_asset/pwa/index.html")
    }

    override fun onDestroy() {
        bridge.shutdown()
        super.onDestroy()
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
}
