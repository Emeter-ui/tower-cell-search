package com.scantowercell

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/**
 * JavaScript bridge for the PWA. Each method is callable from JS as
 * `window.AndroidCellBridge.<name>(...)` and returns a JSON string so the
 * contract across the WebView boundary stays simple and inspectable.
 */
class NativeBridge(
    private val app: Application,
    private val webView: WebView,
    private val onRequestPermissions: () -> Unit,
    private val hasPermission: (String) -> Boolean,
) {
    private val scanner = CellScanner(app)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val liveRunning = AtomicBoolean(false)
    private var liveTicker: Runnable? = null
    private var liveSubId: Int = -1
    private var liveIntervalMs: Long = 3000

    @JavascriptInterface
    fun status(): String {
        val o = JSONObject()
        o.put("present", true)
        o.put("apiLevel", Build.VERSION.SDK_INT)
        o.put("manufacturer", Build.MANUFACTURER)
        o.put("model", Build.MODEL)
        o.put("androidVersion", Build.VERSION.RELEASE)
        o.put("canReadCellInfo", hasPermission(Manifest.permission.ACCESS_FINE_LOCATION))
        o.put("canReadFineLocation", hasPermission(Manifest.permission.ACCESS_FINE_LOCATION))
        o.put("canReadPhoneState", hasPermission(Manifest.permission.READ_PHONE_STATE))
        // `requestNetworkScan` is wrapped by the OS behind carrier privileges /
        // MODIFY_PHONE_STATE on most retail devices — we report "best effort"
        // availability, and the scan code will degrade with a warning if denied.
        o.put("canRequestNetworkScan", Build.VERSION.SDK_INT >= 28)
        o.put("neighborCellSupport", scanner.neighborCellSupport())
        o.put("subscriptions", scanner.listSubscriptions())
        return o.toString()
    }

    @JavascriptInterface
    fun requestPermissions() {
        mainHandler.post { onRequestPermissions() }
    }

    @JavascriptInterface
    fun listSubscriptions(): String = scanner.listSubscriptions().toString()

    @JavascriptInterface
    fun scanOnce(subIdOrNegative: Int): String {
        val warnings = mutableListOf<String>()
        val samples = scanner.scanOnce(subIdOrNegative, warnings)
        return buildScanJson(subIdOrNegative, samples, warnings, source = "getAllCellInfo")
    }

    @JavascriptInterface
    fun requestNetworkScan(subIdOrNegative: Int): String {
        val warnings = mutableListOf<String>()
        val fromNetworkScan = scanner.networkScan(subIdOrNegative, warnings)
        val fromAllCells = scanner.scanOnce(subIdOrNegative, warnings)
        val combined = JSONArray()
        for (i in 0 until fromNetworkScan.length()) combined.put(fromNetworkScan.get(i))
        for (i in 0 until fromAllCells.length()) combined.put(fromAllCells.get(i))
        return buildScanJson(
            subIdOrNegative,
            combined,
            warnings,
            source = if (fromNetworkScan.length() > 0) "getAllCellInfo+networkScan" else "getAllCellInfo",
        )
    }

    @JavascriptInterface
    fun startLive(subIdOrNegative: Int, intervalMs: Int) {
        if (liveRunning.getAndSet(true)) return
        liveSubId = subIdOrNegative
        liveIntervalMs = intervalMs.coerceAtLeast(500).toLong()
        val tick = object : Runnable {
            override fun run() {
                if (!liveRunning.get()) return
                val warnings = mutableListOf<String>()
                val samples = scanner.scanOnce(liveSubId, warnings)
                val json = buildScanJson(liveSubId, samples, warnings, source = "getAllCellInfo")
                mainHandler.post {
                    webView.evaluateJavascript(
                        "window.__cellLive && window.__cellLive(${JSONObject.quote(json)});",
                        null
                    )
                }
                mainHandler.postDelayed(this, liveIntervalMs)
            }
        }
        liveTicker = tick
        mainHandler.post(tick)
    }

    @JavascriptInterface
    fun stopLive() {
        liveRunning.set(false)
        liveTicker?.let { mainHandler.removeCallbacks(it) }
        liveTicker = null
    }

    fun shutdown() {
        stopLive()
        scanner.shutdown()
    }

    private fun buildScanJson(
        subId: Int,
        samples: JSONArray,
        warnings: List<String>,
        source: String,
    ): String {
        val o = JSONObject()
        o.put("scanId", scanner.newScanId())
        o.put("tsMs", System.currentTimeMillis())
        val loc = lastKnownLocation()
        o.put("locationGranted", hasPermission(Manifest.permission.ACCESS_FINE_LOCATION))
        o.put("latitude", loc?.latitude ?: JSONObject.NULL)
        o.put("longitude", loc?.longitude ?: JSONObject.NULL)
        o.put("accuracyM", loc?.accuracy?.toDouble() ?: JSONObject.NULL)
        o.put("samples", samples)
        o.put("source", source)
        val w = JSONArray()
        warnings.forEach { w.put(it) }
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            w.put("Grant Location permission so Android will return cell info.")
        }
        o.put("warnings", w)
        o.put("_subId", subId)
        return o.toString()
    }

    private fun lastKnownLocation(): Location? {
        if (ContextCompat.checkSelfPermission(app, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) return null
        val lm = app.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null
        val providers = lm.getProviders(true)
        var best: Location? = null
        for (p in providers) {
            try {
                val l = lm.getLastKnownLocation(p) ?: continue
                if (best == null || l.accuracy < best.accuracy) best = l
            } catch (_: SecurityException) { /* skip */ }
        }
        return best
    }
}
