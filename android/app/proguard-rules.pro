# The JavaScript bridge class is reachable from the WebView — keep it intact.
-keep class com.scantowercell.NativeBridge { *; }
-keepclassmembers class com.scantowercell.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
