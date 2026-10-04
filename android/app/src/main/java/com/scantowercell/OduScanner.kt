package com.scantowercell

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.security.SecureRandom
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
class OduScanner(private val appContext: Context? = null) {
    private val session = AtomicReference<Session?>(null)
    @Volatile var lastError: String? = null
        private set

    /** Find a WiFi Network, if any — used to pin HTTP calls to the LAN. */
    private fun findWifiNetwork(): Network? {
        val ctx = appContext ?: return null
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE)
                as? ConnectivityManager ?: return null
        for (n in cm.allNetworks) {
            val caps = cm.getNetworkCapabilities(n) ?: continue
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return n
        }
        return null
    }

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

    /**
     * Programmatic ZLT X17U login — matches the SPA logic exactly:
     *   challenge (3830c61a) → token
     *   passwd  = SHA256(token + plaintextPassword)
     *   session = md5(rand) + md5(rand)
     *   POST d2aa9843 with {username, passwd, token, sessionId, cmd, method}
     *   Server returns a real sessionId used for all authenticated calls.
     *
     * Returns a JSON string describing success/failure. On success the
     * session is stored on [this] and ready for scanOnce().
     */
    fun login(rawUrl: String, username: String, password: String): String {
        val baseUrl = normalizeUrl(rawUrl)
        if (baseUrl.isEmpty()) return errorJson("Missing ODU URL.")
        return try {
            // 1. challenge → token
            val chalBody = postCgi(baseUrl, CMD_CHALLENGE, "")
            val chal = JSONObject(chalBody)
            if (!chal.optBoolean("success", false)) {
                return errorJson("Challenge failed: ${chal.optString("message", chalBody.take(120))}")
            }
            val token = chal.optString("token")
            if (token.isEmpty()) return errorJson("No token in challenge response.")

            // 2. login POST
            val passwd = sha256Hex(token + password)
            val nonce = md5Hex(SecureRandom().nextInt().toString()) +
                    md5Hex(SecureRandom().nextInt().toString())
            val payload = JSONObject().apply {
                put("username", username)
                put("passwd", passwd)
                put("token", token)
                put("sessionId", nonce)
                put("cmd", CMD_LOGIN)
                put("method", "POST")
            }
            val loginBody = postCgiRaw(baseUrl, payload.toString())
            val resp = JSONObject(loginBody)

            // Auth failures carry login_fail / login_fail2 even though
            // success=true at the request-protocol level.
            if (resp.optString("login_fail") == "fail") {
                val tries = resp.optString("login_times")
                val msg = "Wrong password. Attempts left before lockout: $tries"
                lastError = msg
                return errorJson(msg)
            }
            if (resp.optString("login_fail2") == "fail") {
                val sec = resp.optString("login_time")
                val msg = "ODU is temporarily locked. Try again in ~$sec s."
                lastError = msg
                return errorJson(msg)
            }
            val sess = resp.optString("sessionId")
            if (sess.isEmpty()) {
                return errorJson("Login succeeded but no sessionId was returned.")
            }
            captureSession(baseUrl, sess)
            successJson("Logged in. user_level=${resp.optString("user_level", "?")}")
        } catch (e: Exception) {
            lastError = e.message
            errorJson("Login failed: ${e.message}")
        }
    }

    private fun successJson(msg: String): String =
        JSONObject().put("ok", true).put("message", msg).toString()

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
            return errorJson("Not logged in to the ODU. Tap 'Log in' first.")
        }
        return try {
            // Probe every known data endpoint and merge whichever returns
            // cellular fields. Firmware revisions seem to shuffle which UUID
            // carries the serving-cell detail, so brute-force merging gives
            // us the best shot at a complete sample.
            val probes = PROBE_CMDS.map { (label, cmd) ->
                val raw = runCatching { postCgi(s.baseUrl, cmd, s.sessionId) }
                    .getOrElse { ex -> "{\"error\":\"${ex.message}\"}" }
                Triple(label, cmd, raw)
            }

            val merged = JSONObject()
            var anySuccess = false
            for ((_, _, raw) in probes) {
                val obj = runCatching { JSONObject(raw) }.getOrNull() ?: continue
                if (obj.optBoolean("success", false)) anySuccess = true
                for (k in obj.keys()) {
                    val v = obj.get(k)
                    if (v is String && v.isEmpty()) continue
                    merged.put(k, v)
                }
            }
            if (!anySuccess) {
                session.set(null)
                val msg = "All ODU endpoints returned success=false. Session likely expired."
                lastError = msg
                return errorJson(msg)
            }
            buildScanJson(merged, probes)
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
        val body = JSONObject().apply {
            put("cmd", cmd)
            put("method", "GET")
            put("sessionId", sessionId)
        }.toString()
        return postCgiRaw(baseUrl, body)
    }

    private fun postCgiRaw(baseUrl: String, bodyJson: String): String {
        val url = URL("$baseUrl/cgi-bin/http.cgi")
        val bodyBytes = bodyJson.toByteArray(Charsets.UTF_8)
        // Pin this request to a WiFi network when we can — avoids the OS
        // routing LAN traffic over cellular when the ODU WiFi has no
        // internet access.
        val wifi = findWifiNetwork()
        val raw = if (wifi != null) wifi.openConnection(url) else url.openConnection()
        val conn = (raw as HttpURLConnection).apply {
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
            conn.outputStream.use { it.write(bodyBytes) }
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

    private fun buildScanJson(
        payload: JSONObject,
        probes: List<Triple<String, String, String>>,
    ): String {
        // Build the ScanResult envelope and emit one sample per populated RAT
        // AND per aggregated carrier. The ZLT firmware packs the primary and
        // CA secondaries into "+"-separated strings (e.g. PCI="421+421+421",
        // FREQ="3500+3250+1873", currentband="8+7+3", bandwidth="10+20+10").
        val now = System.currentTimeMillis()
        val samples = org.json.JSONArray()

        if (hasAny(payload, "PCI", "FREQ", "RSRP", "CELL_ID")) {
            for (cell in lteCarriers(payload)) {
                samples.put(buildSample(now, "LTE", cell))
            }
        }
        if (hasAny(payload, "PCI_5G", "FREQ_5G", "RSRP_5G", "CELL_ID_5G")) {
            for (cell in nrCarriers(payload)) {
                samples.put(buildSample(now, "NR", cell))
            }
        }

        val warnings = org.json.JSONArray()
        if (samples.length() == 0) {
            warnings.put("ODU response had no LTE or NR fields populated.")
        }
        // Report which key cellular fields the merged payload actually carried
        // so the user can see at a glance when the ODU is sending minimal data.
        val fieldStatus = StringBuilder("Fields present:")
        for (k in listOf("PLMN","PCI","FREQ","CELL_ID","ENODEBID","currentband",
                         "bandwidth","RSRP","RSRQ","RSSI","SINR","CQI")) {
            val v = payload.optString(k, "")
            fieldStatus.append(" $k=").append(if (v.isEmpty()) "∅" else v)
        }
        warnings.put(fieldStatus.toString())
        // Per-probe one-liner so we can see which UUID carries which cmd code
        // and whether the serving-cell fields appeared anywhere.
        for ((label, cmd, raw) in probes) {
            val obj = runCatching { JSONObject(raw) }.getOrNull()
            val internalCmd = obj?.optInt("cmd", -1) ?: -1
            val hasPci = obj?.optString("PCI", "")?.isNotEmpty() == true ||
                    obj?.optString("PCI_5G", "")?.isNotEmpty() == true
            val hasFreq = obj?.optString("FREQ", "")?.isNotEmpty() == true ||
                    obj?.optString("FREQ_5G", "")?.isNotEmpty() == true
            warnings.put("$label($cmd) cmd=$internalCmd pci=${hasPci} freq=${hasFreq} raw=${raw.take(400)}")
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

    private fun lteCarriers(p: JSONObject): List<JSONObject> {
        val plmn = p.optString("PLMN", "")
        val mcc = if (plmn.length >= 5) plmn.substring(0, 3) else null
        val mnc = if (plmn.length >= 5) plmn.substring(3) else null
        val pciList = splitPlus(p.optString("PCI"))
        val freqList = splitPlus(p.optString("FREQ"))
        val bandList = splitPlus(p.optString("currentband"))
        val bwList = splitPlus(p.optString("bandwidth"))
        val n = listOf(pciList, freqList, bandList, bwList).maxOf { it.size }
        if (n == 0) return emptyList()

        val tac = parseHex(p.optString("tac_4g"))
        val ci  = parseHex(p.optString("CELL_ID"))
        val rsrp = parseIntOrNull(p.optString("RSRP"))
        val rsrq = parseIntOrNull(p.optString("RSRQ"))
        val rssi = parseIntOrNull(p.optString("RSSI"))
        val sinr = parseIntOrNull(p.optString("SINR"))
        val cqi  = parseIntOrNull(p.optString("CQI"))
        val lvl  = parseIntOrNull(p.optString("signal_lvl"))

        val out = mutableListOf<JSONObject>()
        for (i in 0 until n) {
            val isPrimary = i == 0
            val bwMhz = bwList.getOrNull(i)?.toIntOrNull()
            val o = JSONObject()
            o.put("rat", "LTE")
            o.put("isRegistered", isPrimary)
            o.put("mcc", mcc ?: JSONObject.NULL)
            o.put("mnc", mnc ?: JSONObject.NULL)
            o.put("plmn", if (plmn.isNotEmpty()) plmn else JSONObject.NULL)
            // TAC and ECI are only strictly meaningful for the primary cell.
            o.put("tac", (if (isPrimary) tac else null) ?: JSONObject.NULL)
            o.put("ci",  (if (isPrimary) ci  else null) ?: JSONObject.NULL)
            o.put("pci",    pciList.getOrNull(i)?.toIntOrNull() ?: JSONObject.NULL)
            o.put("earfcn", freqList.getOrNull(i)?.toIntOrNull() ?: JSONObject.NULL)
            o.put("bandwidth", if (bwMhz == null) JSONObject.NULL else bwMhz * 1000)
            val sig = JSONObject()
            // The ODU reports a single stack-wide RSRP; only attach it to the
            // primary carrier so the UI doesn't look like three identical cells
            // all magically at the same level.
            sig.put("rsrp", (if (isPrimary) rsrp else null) ?: JSONObject.NULL)
            sig.put("rsrq", (if (isPrimary) rsrq else null) ?: JSONObject.NULL)
            sig.put("rssi", (if (isPrimary) rssi else null) ?: JSONObject.NULL)
            sig.put("rssnr",(if (isPrimary) sinr else null) ?: JSONObject.NULL)
            sig.put("cqi",  (if (isPrimary) cqi  else null) ?: JSONObject.NULL)
            sig.put("timingAdvance", JSONObject.NULL)
            sig.put("level", lvl ?: JSONObject.NULL)
            o.put("signal", sig)
            out.add(o)
        }
        return out
    }

    private fun nrCarriers(p: JSONObject): List<JSONObject> {
        val plmn = p.optString("PLMN", "")
        val mcc = if (plmn.length >= 5) plmn.substring(0, 3) else null
        val mnc = if (plmn.length >= 5) plmn.substring(3) else null
        val pciList = splitPlus(p.optString("PCI_5G"))
        val freqList = splitPlus(p.optString("FREQ_5G"))
        val n = maxOf(pciList.size, freqList.size)
        if (n == 0) return emptyList()

        val tac = parseHex(p.optString("tac_5g"))
        val nci = parseHex(p.optString("CELL_ID_5G"))
        val rsrp = parseIntOrNull(p.optString("RSRP_5G"))
        val rsrq = parseIntOrNull(p.optString("RSRQ_5G"))
        val sinr = parseIntOrNull(p.optString("SINR_5G"))
            ?: parseIntOrNull(p.optString("S_SINR"))
        val lvl  = parseIntOrNull(p.optString("signal_lvl"))

        val out = mutableListOf<JSONObject>()
        for (i in 0 until n) {
            val isPrimary = i == 0
            val o = JSONObject()
            o.put("rat", "NR")
            o.put("isRegistered", isPrimary)
            o.put("mcc", mcc ?: JSONObject.NULL)
            o.put("mnc", mnc ?: JSONObject.NULL)
            o.put("plmn", if (plmn.isNotEmpty()) plmn else JSONObject.NULL)
            o.put("tac", (if (isPrimary) tac else null) ?: JSONObject.NULL)
            o.put("nci", (if (isPrimary) nci else null) ?: JSONObject.NULL)
            o.put("pci", pciList.getOrNull(i)?.toIntOrNull() ?: JSONObject.NULL)
            o.put("nrarfcn", freqList.getOrNull(i)?.toIntOrNull() ?: JSONObject.NULL)
            val sig = JSONObject()
            sig.put("ssRsrp", (if (isPrimary) rsrp else null) ?: JSONObject.NULL)
            sig.put("ssRsrq", (if (isPrimary) rsrq else null) ?: JSONObject.NULL)
            sig.put("ssSinr", (if (isPrimary) sinr else null) ?: JSONObject.NULL)
            sig.put("csiRsrp", JSONObject.NULL)
            sig.put("csiRsrq", JSONObject.NULL)
            sig.put("csiSinr", JSONObject.NULL)
            sig.put("level", lvl ?: JSONObject.NULL)
            o.put("signal", sig)
            out.add(o)
        }
        return out
    }

    private fun errorJson(message: String): String =
        JSONObject().put("error", message).toString()

    companion object {
        private const val TAG = "OduScanner"
        private const val SUB_ODU = 10001
        // Serving-cell detail (cmd 1002) on firmware X17U-NG0002 1.0.07.
        const val CMD_SERVING_CELL = "89af35c9-b448-4fc7-a477-828a3e9467f8"
        // Polling status (cmd 1009) with signal + uptime + temp.
        const val CMD_LOOP_DATA   = "f3e328b1-c743-4aaf-be88-fdb5e32d7e51"
        const val CMD_CHALLENGE   = "3830c61a-620d-47da-ae47-33d8401401c4"
        const val CMD_LOGIN       = "d2aa9843-494b-4947-9621-a46ec652ecd9"

        // Probe set used by scanOnce() to maximise field coverage. The
        // serving-cell endpoint goes first so its values win on merge.
        val PROBE_CMDS: List<Pair<String, String>> = listOf(
            "Ka"            to "89af35c9-b448-4fc7-a477-828a3e9467f8",
            "Ya"            to "f3e328b1-c743-4aaf-be88-fdb5e32d7e51",
            "getLoopData"   to "2ee26212-96cc-45d3-8f0d-808e4cde884a",
            "getDeviceInfo" to "ece6b6d4-61c7-4dad-af23-c8249c75c58c",
        )

        fun sha256Hex(s: String): String {
            val md = MessageDigest.getInstance("SHA-256")
            val bytes = md.digest(s.toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }
        }
        fun md5Hex(s: String): String {
            val md = MessageDigest.getInstance("MD5")
            val bytes = md.digest(s.toByteArray(Charsets.UTF_8))
            return bytes.joinToString("") { "%02x".format(it) }
        }
        fun normalizeUrl(raw: String?): String {
            val s = raw?.trim() ?: return ""
            if (s.isEmpty()) return ""
            val withScheme = if (s.startsWith("http://") || s.startsWith("https://")) s
            else "http://$s"
            return withScheme.trimEnd('/')
        }

        private fun parseIntOrNull(v: String?): Int? {
            if (v.isNullOrBlank()) return null
            return v.toIntOrNull()
        }
        private fun parseHex(v: String?): Long? {
            if (v.isNullOrBlank()) return null
            return v.toLongOrNull(16) ?: v.toLongOrNull()
        }
        private fun hasAny(obj: JSONObject, vararg keys: String): Boolean {
            for (k in keys) {
                if (obj.optString(k, "").isNotEmpty()) return true
            }
            return false
        }
        /** Split "a+b+c" into ["a","b","c"], dropping empty entries. */
        fun splitPlus(s: String?): List<String> =
            s?.split('+')?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()
    }
}
