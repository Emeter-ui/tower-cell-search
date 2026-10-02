package com.scantowercell

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Opens the ODU admin in a WebView so the user can sign in with the real UI.
 * We watch every outgoing POST and, as soon as we see a non-empty `sessionId`
 * in the body of a `/cgi-bin/http.cgi` call, we hand it to [OduSessionHolder]
 * and finish — the main app can then poll the ODU natively.
 */
class OduLoginActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var statusLine: TextView
    private var baseUrl: String = ""
    private var captured: Boolean = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        baseUrl = normalizeUrl(intent.getStringExtra(EXTRA_URL))
        if (baseUrl.isEmpty()) {
            finish()
            return
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xff0b1220.toInt())
        }

        val headerBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(12), dp(12), dp(12), dp(12))
            setBackgroundColor(0xff111a2e.toInt())
        }
        statusLine = TextView(this).apply {
            text = "Sign in to the ODU admin. We'll detect the session automatically."
            setTextColor(Color.parseColor("#e5edff"))
            textSize = 13f
            layoutParams = LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        val reload = Button(this).apply {
            text = "Retry"
            setOnClickListener {
                statusLine.text = "Reloading $baseUrl…"
                webView.loadUrl(baseUrl)
            }
        }
        val cancel = Button(this).apply {
            text = "Close"
            setOnClickListener { finish() }
        }
        headerBar.addView(statusLine)
        headerBar.addView(reload)
        headerBar.addView(cancel)

        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                useWideViewPort = true
                loadWithOverviewMode = true
                allowFileAccess = false
                allowContentAccess = false
                // Always hit the network; the ODU admin SPA is cheap to
                // re-fetch and this avoids ERR_CACHE_MISS on first load.
                cacheMode = WebSettings.LOAD_NO_CACHE
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
            webViewClient = SniffingClient()
        }

        root.addView(headerBar)
        root.addView(webView)
        setContentView(root, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

        webView.loadUrl(baseUrl)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    // We don't try to intercept POST bodies here — Android's WebView does
    // not expose the body on shouldInterceptRequest, so we'd have to proxy
    // the entire call and that gets fragile. Instead we let the SPA send
    // its own traffic and poll its localStorage for the sessionId every
    // 1.5 seconds (see sessionProbe below).
    private inner class SniffingClient : WebViewClient() {
        override fun onReceivedError(
            view: WebView,
            request: WebResourceRequest,
            error: WebResourceError,
        ) {
            // Only surface top-frame failures (the SPA throws a lot of XHR
            // errors during probing that aren't user-facing).
            if (!request.isForMainFrame) return
            val msg = "Load failed: ${error.description} (code ${error.errorCode}). " +
                "Make sure your WiFi is joined to the ODU."
            runOnUiThread { statusLine.text = msg }
        }
    }

    override fun onResume() {
        super.onResume()
        // Poll the WebView's localStorage / sessionStorage for the sessionId
        // the ZLT SPA stashes after login. This is a reliable proxy for
        // "the user has logged in". We keep polling until we find one.
        webView.postDelayed(sessionProbe, 1500)
    }

    override fun onPause() {
        super.onPause()
        webView.removeCallbacks(sessionProbe)
    }

    private val sessionProbe = object : Runnable {
        override fun run() {
            if (captured) return
            // Dump everything in localStorage and sessionStorage so we don't
            // depend on the SPA using any one specific key name.
            webView.evaluateJavascript(JS_DUMP) { raw ->
                try {
                    val stripped = raw?.trim()?.trim('"')
                        ?.replace("\\\"", "\"")
                        ?.replace("\\\\", "\\")
                    val found = stripped?.let(::findSessionId)
                    if (found != null) {
                        captured = true
                        OduSessionHolder.capture(baseUrl, found)
                        runOnUiThread {
                            statusLine.text = "Session captured. You can close this screen."
                            setResult(RESULT_OK)
                            finish()
                        }
                        return@evaluateJavascript
                    }
                } catch (_: Exception) {
                    /* keep trying */
                }
                webView.postDelayed(this, 1500)
            }
        }
    }

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_URL = "odu_url"

        private const val JS_DUMP = """
            (function(){
              var out = {};
              try { for (var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); out['L:'+k]=localStorage.getItem(k); } } catch(e){}
              try { for (var i=0;i<sessionStorage.length;i++){ var k=sessionStorage.key(i); out['S:'+k]=sessionStorage.getItem(k); } } catch(e){}
              return JSON.stringify(out);
            })();
        """

        // The ZLT sessionId is a 64-char lowercase hex string. Grep for one.
        private val SESSION_RX = Regex("[0-9a-f]{64}")

        fun findSessionId(dump: String): String? {
            if (dump.isEmpty()) return null
            return SESSION_RX.find(dump)?.value
        }

        fun start(from: AppCompatActivity, url: String) {
            val i = Intent(from, OduLoginActivity::class.java)
            i.putExtra(EXTRA_URL, url)
            from.startActivity(i)
        }

        /** Prepend http:// if the user typed a bare IP, strip trailing slash. */
        fun normalizeUrl(raw: String?): String {
            val s = raw?.trim() ?: return ""
            if (s.isEmpty()) return ""
            val withScheme = if (s.startsWith("http://") || s.startsWith("https://")) s
            else "http://$s"
            return withScheme.trimEnd('/')
        }
    }
}

/**
 * Static holder so OduLoginActivity can hand the captured session to the
 * long-lived [OduScanner] owned by [NativeBridge].
 */
object OduSessionHolder {
    @Volatile private var pending: Pair<String, String>? = null
    fun capture(baseUrl: String, sessionId: String) {
        pending = baseUrl to sessionId
    }
    fun drain(into: OduScanner): Boolean {
        val p = pending ?: return false
        pending = null
        into.captureSession(p.first, p.second)
        return true
    }
}
