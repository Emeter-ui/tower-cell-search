# scan-tower-cell

A professional Android-compatible PWA cellular network scanner. The PWA is a
React/TypeScript dashboard; the Android companion is a Kotlin app that reads
`TelephonyManager` / `getAllCellInfo()` and exposes it to the PWA through a
JavaScript bridge. The same PWA bundle is installable as a standalone PWA — in
that case the native bridge is unavailable and the UI says so.

The scanner surfaces exactly what the Android HAL returns. It does not
fabricate PCI, EARFCN, RSRP, RSRQ, SINR or Cell IDs. Fields the device won't
report are labelled **Unavailable / Restricted**.

## What the project contains

- `pwa/` — Vite + React + TypeScript + Tailwind PWA (installable).
- `android/` — Kotlin companion that hosts the PWA in a WebView and bridges
  Telephony APIs via `@JavascriptInterface`.
- 3GPP-correct LTE EARFCN ↔ frequency and 5G NR-ARFCN ↔ frequency math.
- Full LTE band database (B1-B71 including B2/3/4/5/7/8/12/13/14/17/18/19/20/
  25/26/28/29/30/32/34/38/39/40/41/42/43/46/48/66/71).
- 5G NR band database (n1-n84, n257/258/260/261).
- CSV + JSON export, JSON import.
- Live monitor with change detection (band / PCI / cell / signal).
- Dual-SIM aware, dark theme, bottom-nav, touch-friendly.

## Build the PWA

    cd pwa
    npm install
    npm run dev        # http://localhost:5173 — bridge absent, Tools work
    npm run build      # outputs pwa/dist

Deploy `pwa/dist` to any static host for the browser-only mode (Tools, band
database, EARFCN/NR-ARFCN calculator, imported scan analysis).

## Build the Android companion

The Android app loads the PWA from its own `assets/pwa/` directory, so build
the PWA first and copy it in:

    cd pwa && npm run build
    rm -rf ../android/app/src/main/assets/pwa
    cp -r dist ../android/app/src/main/assets/pwa

Then build the APK. You need:

- Android SDK with API 34 installed (`ANDROID_HOME` set).
- Gradle 8.6+ (either system `gradle` or run `gradle wrapper --gradle-version 8.6`
  inside `android/` once, then use `./gradlew`).

```
cd ../android
gradle wrapper --gradle-version 8.6     # one-time: generates gradlew
./gradlew assembleDebug
# APK at android/app/build/outputs/apk/debug/app-debug.apk
```

Open the project in Android Studio instead if you prefer — it will offer
to install the right Gradle wrapper automatically.

## Build the APK on GitHub (no local Android SDK)

A workflow at `.github/workflows/android.yml` builds the APK in the cloud:

1. Create a new GitHub repo and push this project.
2. Open the repo → **Actions** tab. The *Build Android APK* workflow runs
   automatically on push (and you can also trigger it manually with the
   **Run workflow** button).
3. When the run succeeds, scroll to the **Artifacts** panel at the bottom
   and download `scan-tower-cell-debug-apk` — that zip contains
   `app-debug.apk`.
4. Install it on your phone: `adb install -r app-debug.apk`, or copy it
   to the phone and tap it (you'll need to allow installing from unknown
   sources).

The job runs on `ubuntu-latest`, uses JDK 17 and Android SDK 34, builds the
PWA, copies it into the Android assets, and runs `./gradlew assembleDebug`.

Install on a device:

    adb install -r app/build/outputs/apk/debug/app-debug.apk

On first launch, grant **Location** (needed by Android to return cell info)
and **Phone** (for subscription / PLMN). The app never asks for permissions
it doesn't use.

## What actually works on Android

| Area | Status |
|---|---|
| Serving LTE cell: PCI / EARFCN / TAC / CI / RSRP / RSRQ / RSSI / SINR / CQI / TA | ✅ API 24+ |
| Serving NR cell: NCI / NR-ARFCN / PCI / TAC / SS-RSRP / SS-RSRQ / SS-SINR | ✅ API 29+ |
| Neighbor cells | ⚠️ Device-dependent — many OEMs expose only serving |
| `requestNetworkScan()` on arbitrary bands | ⚠️ Needs carrier privileges — opportunistic, falls back to `getAllCellInfo()` polling |
| Tower lat/lon | ❌ Not available on Android — labelled "tower location unknown" |
| Dual SIM | ✅ `SubscriptionManager` — every record tagged with subId |

## Privacy

Scan data stays in the browser's `localStorage` (or the WebView's storage) by
default. There is no cloud sync. Location, when granted, is used only to tag
scan records locally.
