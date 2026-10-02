package com.scantowercell

import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/**
 * ZLT X17U (Airtel-branded 5G/4G ODU) scanner.
 *
 * The ODU admin SPA posts to `${baseUrl}/cgi-bin/http.cgi` with a JSON body:
 *   {"cmd":"<UUID>","method":"GET"|"POST","sessionId":"<64-hex>","token":"<32-hex>"}
 *
 * Cmd UUIDs discovered empirically:
 *   f3e328b1-c743-4aaf-be88-fdb5e32d7e51 → serving-cell detail (internal cmd 1002)
 *     contains PCI, FREQ (= EARFCN), CELL_ID (hex), ENODEBID, PLMN,
 *     currentband, bandwidth, RSRP, RSRQ, RSSI, SINR, CQI — both 4G and _5G
 *     variants. This is the one we poll.
 *
 * Rather than reverse-engineering the salted login hash, we drive login
 * through a WebView (OduLoginActivity) and sniff `shouldInterceptRequest` for
 * the sessionId that gets attached to authenticated calls. Once we have it,
 * we poll the serving-cell endpoint directly from native code.
 */
class OduScanner {
    private val session = AtomicReference<Session?>(null)
    @Volatile var lastError: String? = null
        private set

    data class Session(val baseUrl: String, val sessionId: String, val capturedAtMs: Long)

    fun hasSession(): Boolean = session.get() != null

    fun currentSession(): Session? = session.get()

    /** Called from OduLoginActivity whenever a POST sessionId is observed. */
    fun captureSession(baseUrl: String, sessionId: String) {
        if (sessionId.length < 32) return
        session.set(Session(baseUrl.trimEnd('/'), sessionId, System.currentTimeMillis()))
        lastError = null
        Log.d(TAG, "Captured ODU session (length=${sessionId.length})")
    }

    fun clear() {
        session.set(null)
        lastError = null
    }

    fun status(): JSONObject {
        val s = session.get()
        val o = JSONObject()
        o.put("configured", s != null)
        o.put("loggedIn", s != null)
        o.put("url", s?.baseUrl ?: JSONObject.NULL)
        o.put(
            "sessionAgeMs",
            if (s == null) JSONObject.NULL else System.currentTimeMillis() - s.capturedAtMs
        )
        o.put("lastError", lastError ?: JSONObject.NULL)
        return o
    }

    /**
     * Pulls one serving-cell snapshot. Returns either the ScanResult JSON for
     * the PWA, or {"error": "..."} if we couldn't fetch.
     */
    fun scanOnce(): String {
        val s = session.get()
        if (s == null) {
            return errorJson("Not logged in to the ODU. Tap 'Open ODU admin to log in'.")
        }
        return try {
            val body = postCgi(s.baseUrl, CMD_SERVING_CELL, s.sessionId)
            val payload = JSONObject(body)
            if (!payload.optBoolean("success", false)) {
                // Likely session expired; drop it so the UI can prompt a fresh login.
                session.set(null)
                val msg = "ODU responded success=false (session may have expired)."
                lastError = msg
                return errorJson(msg)
            }
            buildScanJson(payload)
        } catch (e: SessionLostException) {
            session.set(null)
            lastError = e.message
            errorJson(e.message ?: "Session lost")
        } catch (e: Exception) {
            lastError = e.message
            errorJson("ODU request failed: ${e.message}")
        }
    }

    // --- Internals ---

    private class SessionLostException(msg: String) : RuntimeException(msg)

    private fun postCgi(baseUrl: String, cmd: String, sessionId: String): String {
        val url = URL("$baseUrl/cgi-bin/http.cgi")
        val body = JSONObject().apply {
            put("cmd", cmd)
            put("method", "GET")
            put("sessionId", sessionId)
        }.toString().toByteArray(Charsets.UTF_8)

        val conn = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            requestMethod = "POST"
            doOutput = true
            setRequestProperty("Content-Type", "application/json;charset=UTF-8")
            setRequestProperty("Accept", "application/json, text/plain, */*")
            setRequestProperty("Origin", baseUrl)
            setRequestProperty("Referer", "$baseUrl/")
        }
        try {
            conn.outputStream.use { it.write(body) }
            val code = conn.responseCode
            if (code == 401 || code == 403) {
                throw SessionLostException("ODU returned HTTP $code — need to log in again.")
            }
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            return stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private fun buildScanJson(payload: JSONObject): String {
        // Build the ScanResult envelope and emit one sample per populated RAT.
        val now = System.currentTimeMillis()
        val samples = org.json.JSONArray()

        if (payload.hasAny("PCI", "FREQ", "RSRP", "CELL_ID")) {
            samples.put(buildSample(now, "LTE", lteCell(payload)))
        }
        if (payload.hasAny("PCI_5G", "FREQ_5G", "RSRP_5G", "CELL_ID_5G")) {
            samples.put(buildSample(now, "NR", nrCell(payload)))
        }

        val warnings = org.json.JSONArray()
        if (samples.length() == 0) {
            warnings.put("ODU response had no LTE or NR fields populated.")
        }

        val scan = JSONObject()
        scan.put("scanId", "odu-" + UUID.randomUUID().toString().take(8))
        scan.put("tsMs", now)
        scan.put("locationGranted", false)
        scan.put("latitude", JSONObject.NULL)
        scan.put("longitude", JSONObject.NULL)
        scan.put("accuracyM", JSONObject.NULL)
        scan.put("samples", samples)
        scan.put("source", "ODU: ZLT X17U")
        scan.put("warnings", warnings)
        return scan.toString()
    }

    private fun buildSample(nowMs: Long, @Suppress("UNUSED_PARAMETER") rat: String, cell: JSONObject): JSONObject {
        val sample = JSONObject()
        sample.put("subId", SUB_ODU)
        sample.put("slotIndex", 0)
        sample.put("tsMs", nowMs)
        sample.put("cell", cell)
        return sample
    }

    private fun lteCell(p: JSONObject): JSONObject {
        val plmn = p.optString("PLMN", "")
        val mcc = if (plmn.length >= 5) plmn.substring(0, 3) else null
        val mnc = if (plmn.length >= 5) plmn.substring(3) else null
        val o = JSONObject()
        o.put("rat", "LTE")
        o.put("isRegistered", true)
        o.put("mcc", mcc ?: JSONObject.NULL)
        o.put("mnc", mnc ?: JSONObject.NULL)
        o.put("plmn", if (plmn.isNotEmpty()) plmn else JSONObject.NULL)
        o.put("tac", parseHex(p.optString("tac_4g")))
        o.put("ci", parseHex(p.optString("CELL_ID")))
        o.put("pci", parseIntOrNull(p.optString("PCI")))
        o.put("earfcn", parseIntOrNull(p.optString("FREQ")))
        val bwMhz = parseIntOrNull(p.optString("bandwidth"))
        o.put("bandwidth", if (bwMhz == null) JSONObject.NULL else bwMhz * 1000)
        val sig = JSONObject()
        sig.put("rsrp", parseIntOrNull(p.optString("RSRP")))
        sig.put("rsrq", parseIntOrNull(p.optString("RSRQ")))
        sig.put("rssi", parseIntOrNull(p.optString("RSSI")))
        sig.put("rssnr", parseIntOrNull(p.optString("SINR")))
        sig.put("cqi", parseIntOrNull(p.optString("CQI")))
        sig.put("timingAdvance", JSONObject.NULL)
        sig.put("level", parseIntOrNull(p.optString("signal_lvl")))
        o.put("signal", sig)
        return o
    }

    private fun nrCell(p: JSONObject): JSONObject {
        val plmn = p.optString("PLMN", "")
        val mcc = if (plmn.length >= 5) plmn.substring(0, 3) else null
        val mnc = if (plmn.length >= 5) plmn.substring(3) else null
        val o = JSONObject()
        o.put("rat", "NR")
        o.put("isRegistered", true)
        o.put("mcc", mcc ?: JSONObject.NULL)
        o.put("mnc", mnc ?: JSONObject.NULL)
        o.put("plmn", if (plmn.isNotEmpty()) plmn else JSONObject.NULL)
        o.put("tac", parseHex(p.optString("tac_5g")))
        o.put("nci", parseHex(p.optString("CELL_ID_5G")))
        o.put("pci", parseIntOrNull(p.optString("PCI_5G")))
        o.put("nrarfcn", parseIntOrNull(p.optString("FREQ_5G")))
        val sig = JSONObject()
        sig.put("ssRsrp", parseIntOrNull(p.optString("RSRP_5G")))
        sig.put("ssRsrq", parseIntOrNull(p.optString("RSRQ_5G")))
        val sinr5g = parseIntOrNull(p.optString("SINR_5G"))
            ?: parseIntOrNull(p.optString("S_SINR"))
        sig.put("ssSinr", sinr5g ?: JSONObject.NULL)
        sig.put("csiRsrp", JSONObject.NULL)
        sig.put("csiRsrq", JSONObject.NULL)
        sig.put("csiSinr", JSONObject.NULL)
        sig.put("level", parseIntOrNull(p.optString("signal_lvl")))
        o.put("signal", sig)
        return o
    }

    private fun errorJson(message: String): String =
        JSONObject().put("error", message).toString()

    companion object {
        private const val TAG = "OduScanner"
        private const val SUB_ODU = 10001
        const val CMD_SERVING_CELL = "f3e328b1-c743-4aaf-be88-fdb5e32d7e51"

        private fun parseIntOrNull(v: String?): Any {
            if (v.isNullOrBlank()) return JSONObject.NULL
            return v.toIntOrNull() ?: JSONObject.NULL
        }
        private fun parseHex(v: String?): Any {
            if (v.isNullOrBlank()) return JSONObject.NULL
            v.toLongOrNull(16)?.let { return it }
            return v.toLongOrNull() ?: JSONObject.NULL
        }
        private fun JSONObject.hasAny(vararg keys: String): Boolean {
            for (k in keys) {
                val v = this.optString(k, "")
                if (v.isNotEmpty()) return true
            }
            return false
        }
    }
}
