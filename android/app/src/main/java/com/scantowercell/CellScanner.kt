package com.scantowercell

import android.Manifest
import android.annotation.SuppressLint
import android.annotation.TargetApi
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellIdentityGsm
import android.telephony.CellIdentityLte
import android.telephony.CellIdentityNr
import android.telephony.CellIdentityWcdma
import android.telephony.CellInfo
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellInfoWcdma
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.CellSignalStrengthWcdma
import android.telephony.NetworkScan
import android.telephony.NetworkScanRequest
import android.telephony.RadioAccessSpecifier
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.telephony.TelephonyScanManager
import android.telephony.AccessNetworkConstants
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executor
import java.util.concurrent.Executors

/**
 * Reads the Android Telephony APIs and converts the results into the JSON
 * contract that `pwa/src/bridge/types.ts` describes. Any field the HAL
 * reports as `UNAVAILABLE` becomes JSON null — the UI shows those as
 * "Unavailable / Restricted". No fabricated values.
 */
class CellScanner(private val context: Context) {

    private val subscriptionManager: SubscriptionManager =
        context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE)
                as SubscriptionManager
    private val telephonyManager: TelephonyManager =
        context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

    private val scanExecutor: Executor = Executors.newSingleThreadExecutor()
    private var inFlightNetworkScan: NetworkScan? = null

    fun listSubscriptions(): JSONArray {
        val arr = JSONArray()
        if (!hasPermission(Manifest.permission.READ_PHONE_STATE)) return arr
        val defaultData = SubscriptionManager.getDefaultDataSubscriptionId()
        val defaultVoice = SubscriptionManager.getDefaultVoiceSubscriptionId()
        val subs: List<SubscriptionInfo> = try {
            subscriptionManager.activeSubscriptionInfoList ?: emptyList()
        } catch (_: SecurityException) {
            emptyList()
        }
        for (s in subs) {
            val o = JSONObject()
            o.put("subId", s.subscriptionId)
            o.put("slotIndex", s.simSlotIndex)
            o.put("carrierName", s.carrierName?.toString())
            o.put("displayName", s.displayName?.toString())
            // SubscriptionInfo exposes MCC/MNC as strings since API 29.
            val (mcc, mnc) = subMccMnc(s)
            o.put("mcc", mcc)
            o.put("mnc", mnc)
            o.put("isDefaultData", s.subscriptionId == defaultData)
            o.put("isDefaultVoice", s.subscriptionId == defaultVoice)
            arr.put(o)
        }
        return arr
    }

    private fun subMccMnc(s: SubscriptionInfo): Pair<String?, String?> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            s.mccString to s.mncString
        } else {
            @Suppress("DEPRECATION")
            (if (s.mcc != 0) s.mcc.toString() else null) to
                    (if (s.mnc != 0) s.mnc.toString().padStart(2, '0') else null)
        }
    }

    private fun tmFor(subId: Int): TelephonyManager {
        return if (subId > 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            telephonyManager.createForSubscriptionId(subId)
        } else telephonyManager
    }

    @SuppressLint("MissingPermission")
    fun scanOnce(subId: Int, warnings: MutableList<String>): JSONArray {
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            warnings.add("ACCESS_FINE_LOCATION not granted — Android will not return cell info.")
            return JSONArray()
        }
        val tm = tmFor(subId)
        val list: List<CellInfo> = try {
            tm.allCellInfo ?: emptyList()
        } catch (e: SecurityException) {
            warnings.add("SecurityException reading cell info: ${e.message}")
            emptyList()
        }
        if (list.isEmpty()) {
            warnings.add("getAllCellInfo() returned an empty list — device may not expose cells here, or radio is in a low-power state.")
        }
        val arr = JSONArray()
        for (ci in list) {
            val json = cellInfoToJson(ci) ?: continue
            val sample = JSONObject()
            sample.put(
                "subId",
                if (subId > 0) subId else SubscriptionManager.getDefaultSubscriptionId()
            )
            sample.put("slotIndex", slotForSub(subId))
            sample.put("tsMs", ci.timeStamp / 1_000_000) // nanos → ms
            sample.put("cell", json)
            arr.put(sample)
        }
        return arr
    }

    private fun slotForSub(subId: Int): Int {
        if (subId <= 0) return 0
        return try {
            subscriptionManager.activeSubscriptionInfoList
                ?.firstOrNull { it.subscriptionId == subId }?.simSlotIndex ?: 0
        } catch (_: SecurityException) { 0 }
    }

    /**
     * Opportunistic active scan via `requestNetworkScan`. The API documents
     * that most 3rd-party apps won't have carrier privileges, so this is
     * expected to be denied on retail devices — we return the empty result
     * plus a warning in that case rather than crashing.
     */
    @TargetApi(Build.VERSION_CODES.Q)
    fun networkScan(subId: Int, warnings: MutableList<String>): JSONArray {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            warnings.add("requestNetworkScan with Executor callback requires Android 10 (API 29).")
            return JSONArray()
        }
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            warnings.add("ACCESS_FINE_LOCATION not granted.")
            return JSONArray()
        }
        val tm = tmFor(subId)
        val req = NetworkScanRequest(
            NetworkScanRequest.SCAN_TYPE_ONE_SHOT,
            arrayOf(
                RadioAccessSpecifier(
                    AccessNetworkConstants.AccessNetworkType.EUTRAN,
                    null,
                    null
                ),
                RadioAccessSpecifier(
                    AccessNetworkConstants.AccessNetworkType.NGRAN,
                    null,
                    null
                ),
            ),
            60,  // search periodicity sec (unused for one-shot)
            60,  // max search time sec
            true,
            3,   // incremental results periodicity
            null
        )
        val collected = JSONArray()
        val latch = java.util.concurrent.CountDownLatch(1)
        val cb = object : TelephonyScanManager.NetworkScanCallback() {
            override fun onResults(results: MutableList<CellInfo>) {
                results.forEach { ci ->
                    cellInfoToJson(ci)?.let {
                        val s = JSONObject()
                        s.put("subId", if (subId > 0) subId else SubscriptionManager.getDefaultSubscriptionId())
                        s.put("slotIndex", slotForSub(subId))
                        s.put("tsMs", ci.timeStamp / 1_000_000)
                        s.put("cell", it)
                        collected.put(s)
                    }
                }
            }
            override fun onComplete() { latch.countDown() }
            override fun onError(error: Int) {
                warnings.add("requestNetworkScan error $error — likely needs carrier privileges on this device. Falling back to getAllCellInfo().")
                latch.countDown()
            }
        }
        try {
            inFlightNetworkScan = tm.requestNetworkScan(req, scanExecutor, cb)
        } catch (e: SecurityException) {
            warnings.add("requestNetworkScan denied: ${e.message}. Falling back to getAllCellInfo().")
            return JSONArray()
        } catch (e: Exception) {
            warnings.add("requestNetworkScan threw: ${e.message}")
            return JSONArray()
        }
        latch.await(70, java.util.concurrent.TimeUnit.SECONDS)
        try { inFlightNetworkScan?.stopScan() } catch (_: Exception) {}
        inFlightNetworkScan = null
        return collected
    }

    private fun cellInfoToJson(ci: CellInfo): JSONObject? {
        // The API check guards the `is CellInfoNr` match so that older
        // runtimes never have to resolve the NR classes during verification.
        return when {
            ci is CellInfoLte -> lteToJson(ci)
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && ci is CellInfoNr -> nrToJson(ci)
            ci is CellInfoWcdma -> wcdmaToJson(ci)
            ci is CellInfoGsm -> gsmToJson(ci)
            else -> null
        }
    }

    private fun lteToJson(ci: CellInfoLte): JSONObject {
        val id: CellIdentityLte = ci.cellIdentity
        val ss: CellSignalStrengthLte = ci.cellSignalStrength
        val o = JSONObject()
        o.put("rat", "LTE")
        o.put("isRegistered", ci.isRegistered)
        val mcc = if (Build.VERSION.SDK_INT >= 28) id.mccString
                  else nonUnavailableInt(@Suppress("DEPRECATION") id.mcc)?.toString()
        val mnc = if (Build.VERSION.SDK_INT >= 28) id.mncString
                  else nonUnavailableInt(@Suppress("DEPRECATION") id.mnc)?.toString()
        o.put("mcc", mcc)
        o.put("mnc", mnc)
        o.put("plmn", plmn(mcc, mnc))
        o.put("tac", nonUnavailableInt(id.tac))
        o.put("ci", nonUnavailableInt(id.ci))
        o.put("pci", nonUnavailableInt(id.pci))
        o.put("earfcn", if (Build.VERSION.SDK_INT >= 24) nonUnavailableInt(id.earfcn) else JSONObject.NULL)
        o.put("bandwidth", if (Build.VERSION.SDK_INT >= 28) nonUnavailableInt(id.bandwidth) else JSONObject.NULL)
        val sig = JSONObject()
        sig.put("rsrp", nonUnavailableInt(ss.rsrp))
        sig.put("rsrq", nonUnavailableInt(ss.rsrq))
        sig.put("rssi", if (Build.VERSION.SDK_INT >= 29) nonUnavailableInt(ss.rssi) else JSONObject.NULL)
        sig.put("rssnr", nonUnavailableInt(ss.rssnr))
        sig.put("cqi", nonUnavailableInt(ss.cqi))
        sig.put("timingAdvance", nonUnavailableInt(ss.timingAdvance))
        sig.put("level", ss.level)
        o.put("signal", sig)
        return o
    }

    @TargetApi(29)
    private fun nrToJson(ci: CellInfoNr): JSONObject {
        val id = ci.cellIdentity as CellIdentityNr
        val ss = ci.cellSignalStrength as CellSignalStrengthNr
        val o = JSONObject()
        o.put("rat", "NR")
        o.put("isRegistered", ci.isRegistered)
        o.put("mcc", id.mccString)
        o.put("mnc", id.mncString)
        o.put("plmn", plmn(id.mccString, id.mncString))
        o.put("tac", nonUnavailableInt(id.tac))
        val nci = id.nci
        o.put("nci", if (nci == CellInfo.UNAVAILABLE_LONG) JSONObject.NULL else nci)
        o.put("pci", nonUnavailableInt(id.pci))
        o.put("nrarfcn", nonUnavailableInt(id.nrarfcn))
        val sig = JSONObject()
        sig.put("ssRsrp", nonUnavailableInt(ss.ssRsrp))
        sig.put("ssRsrq", nonUnavailableInt(ss.ssRsrq))
        sig.put("ssSinr", nonUnavailableInt(ss.ssSinr))
        sig.put("csiRsrp", nonUnavailableInt(ss.csiRsrp))
        sig.put("csiRsrq", nonUnavailableInt(ss.csiRsrq))
        sig.put("csiSinr", nonUnavailableInt(ss.csiSinr))
        sig.put("level", ss.level)
        o.put("signal", sig)
        return o
    }

    private fun wcdmaToJson(ci: CellInfoWcdma): JSONObject {
        val id: CellIdentityWcdma = ci.cellIdentity
        val ss: CellSignalStrengthWcdma = ci.cellSignalStrength
        val o = JSONObject()
        o.put("rat", "WCDMA")
        o.put("isRegistered", ci.isRegistered)
        val mcc = if (Build.VERSION.SDK_INT >= 28) id.mccString
                  else nonUnavailableInt(@Suppress("DEPRECATION") id.mcc)?.toString()
        val mnc = if (Build.VERSION.SDK_INT >= 28) id.mncString
                  else nonUnavailableInt(@Suppress("DEPRECATION") id.mnc)?.toString()
        o.put("mcc", mcc)
        o.put("mnc", mnc)
        o.put("plmn", plmn(mcc, mnc))
        o.put("lac", nonUnavailableInt(id.lac))
        o.put("cid", nonUnavailableInt(id.cid))
        o.put("psc", nonUnavailableInt(id.psc))
        o.put("uarfcn", if (Build.VERSION.SDK_INT >= 24) nonUnavailableInt(id.uarfcn) else JSONObject.NULL)
        val sig = JSONObject()
        sig.put("rscp", nonUnavailableInt(ss.dbm))
        sig.put("ecno", if (Build.VERSION.SDK_INT >= 30) nonUnavailableInt(ss.ecNo) else JSONObject.NULL)
        sig.put("level", ss.level)
        o.put("signal", sig)
        return o
    }

    private fun gsmToJson(ci: CellInfoGsm): JSONObject {
        val id: CellIdentityGsm = ci.cellIdentity
        val ss: CellSignalStrengthGsm = ci.cellSignalStrength
        val o = JSONObject()
        o.put("rat", "GSM")
        o.put("isRegistered", ci.isRegistered)
        val mcc = if (Build.VERSION.SDK_INT >= 28) id.mccString
                  else nonUnavailableInt(@Suppress("DEPRECATION") id.mcc)?.toString()
        val mnc = if (Build.VERSION.SDK_INT >= 28) id.mncString
                  else nonUnavailableInt(@Suppress("DEPRECATION") id.mnc)?.toString()
        o.put("mcc", mcc)
        o.put("mnc", mnc)
        o.put("plmn", plmn(mcc, mnc))
        o.put("lac", nonUnavailableInt(id.lac))
        o.put("cid", nonUnavailableInt(id.cid))
        o.put("arfcn", if (Build.VERSION.SDK_INT >= 24) nonUnavailableInt(id.arfcn) else JSONObject.NULL)
        o.put("bsic", if (Build.VERSION.SDK_INT >= 24) nonUnavailableInt(id.bsic) else JSONObject.NULL)
        val sig = JSONObject()
        sig.put("rssi", nonUnavailableInt(ss.dbm))
        sig.put("ber", nonUnavailableInt(ss.bitErrorRate))
        sig.put("level", ss.level)
        o.put("signal", sig)
        return o
    }

    /** Convert `CellInfo.UNAVAILABLE` sentinel (Integer.MAX_VALUE) to JSON null. */
    private fun nonUnavailableInt(v: Int): Any {
        return if (v == CellInfo.UNAVAILABLE || v == Int.MAX_VALUE) JSONObject.NULL else v
    }

    private fun plmn(mcc: String?, mnc: String?): Any {
        return if (mcc.isNullOrEmpty() || mnc.isNullOrEmpty()) JSONObject.NULL
        else mcc + mnc
    }

    fun neighborCellSupport(): String {
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) return "unknown"
        return try {
            val list = telephonyManager.allCellInfo ?: return "unknown"
            val neighbors = list.count { !it.isRegistered }
            when {
                neighbors > 0 -> "yes"
                list.isNotEmpty() -> "no"
                else -> "unknown"
            }
        } catch (_: SecurityException) {
            "unknown"
        }
    }

    fun shutdown() {
        try { inFlightNetworkScan?.stopScan() } catch (_: Exception) {}
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun newScanId(): String = "scan-" + UUID.randomUUID().toString().take(8)
}
