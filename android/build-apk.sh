#!/usr/bin/env bash
# THIRD EYE APK builder — idempotent, wipe-proof.
# Usage: bash /home/user/build-apk.sh
set -e
AB=/home/user/.cache/ab
APP=/home/user/android-app
BT=$AB/sdk/build-tools/34.0.0

echo "== 1) toolchain (skip if present) =="
mkdir -p $AB/dl
if [ ! -x $AB/jdk17/bin/java ]; then
  cd $AB
  [ -f dl/jdk17.tar.gz ] || curl -sL -o dl/jdk17.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse" --max-time 400
  tar -xzf dl/jdk17.tar.gz && mv jdk-17* jdk17
fi
if [ ! -x $AB/gradle/bin/gradle ]; then
  cd $AB
  [ -f dl/gradle.zip ] || curl -sL -o dl/gradle.zip "https://services.gradle.org/distributions/gradle-8.7-bin.zip" --max-time 400
  unzip -q dl/gradle.zip && mv gradle-8.7 gradle
fi
if [ ! -d $AB/sdk/platforms/android-34 ]; then
  cd $AB
  [ -f dl/platform.zip ] || curl -sL -o dl/platform.zip "https://dl.google.com/android/repository/platform-34-ext7_r03.zip" --max-time 400
  unzip -q dl/platform.zip -d plat_tmp && mkdir -p sdk/platforms && mv plat_tmp/* sdk/platforms/android-34
fi
if [ ! -x $BT/aapt2 ]; then
  cd $AB
  [ -f dl/buildtools.zip ] || curl -sL -o dl/buildtools.zip "https://dl.google.com/android/repository/build-tools_r34-linux.zip" --max-time 400
  unzip -q dl/buildtools.zip -d bt_tmp && mkdir -p sdk/build-tools/34.0.0 && mv bt_tmp/*/* sdk/build-tools/34.0.0/
fi
mkdir -p $AB/sdk/licenses
echo "24333f8a63b6825ea1c811f78b3b9de86fd6c413" > $AB/sdk/licenses/android-sdk-license
echo "d56f5187479451eabf01fb78af6dfcb131a6481e" >> $AB/sdk/licenses/android-sdk-license

echo "== 2) project files =="
mkdir -p $APP/app/src/main/java/eye/third/web $APP/app/src/main/res/drawable
cd $APP

cat > settings.gradle << 'EOF'
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = 'ThirdEye'
include ':app'
EOF

cat > build.gradle << 'EOF'
plugins {
    id 'com.android.application' version '8.5.2' apply false
}
EOF

cat > gradle.properties << 'EOF'
org.gradle.jvmargs=-Xmx1024m -Dfile.encoding=UTF-8
android.nonTransitiveRClass=true
EOF

cat > app/build.gradle << 'EOF'
plugins {
    id 'com.android.application'
}

android {
    namespace 'eye.third.web'
    compileSdk 34
    defaultConfig {
        applicationId 'eye.third.web'
        minSdk 24
        targetSdk 34
        versionCode 6
        versionName '1.6'
    }
    buildTypes {
        release { minifyEnabled false }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}
EOF

cat > app/src/main/AndroidManifest.xml << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <application
        android:label="Third Eye"
        android:icon="@drawable/ic_eye"
        android:hardwareAccelerated="true"
        android:usesCleartextTraffic="false"
        android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|density|uiMode"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
EOF

cat > app/src/main/java/eye/third/web/MainActivity.java << 'EOF'
package eye.third.web;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

/**
 * THIRD EYE Android shell (v1.3).
 * v1.3 device-WebView fixes:
 *  - rendererPriorityPolicy(IMPORTANT): some OEM WebViews throttle the GL
 *    renderer => blank globe. Keep the renderer at full priority while the
 *    activity is visible.
 *  - launch Toast shows the exact build (no more "kaunsa version chal raha?").
 *  - onPageFinished WebGL probe: if the context cannot be created, an on-page
 *    banner says so instead of a silently white globe.
 * Retained from v1.2: Chrome-parity viewport (no wide viewport), near-black
 * backdrop behind WebGL, dark RETRY error page, re-applied immersive mode.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = "https://third-eye-theta.vercel.app/";
    private static final String ERROR_HTML =
        "<html><body style='background:#0a0a0f;color:#8fd8ff;"
        + "font-family:monospace;display:flex;align-items:center;justify-content:center;"
        + "height:100%;margin:0'>"
        + "<div style='text-align:center'>"
        + "<div style='font-size:22px;letter-spacing:4px'>THIRD EYE</div>"
        + "<div style='font-size:13px;opacity:.7;margin:14px 0'>Network unreachable — internet check karo</div>"
        + "<button onclick='location.replace(\"" + APP_URL + "\")' "
        + "style='background:#123c52;color:#40c7ff;border:1px solid #28c7ff;"
        + "padding:10px 26px;font-size:15px;letter-spacing:2px'>RETRY</button>"
        + "</div></body></html>";

    private static final String GL_PROBE_JS =
        "(function(){try{var c=document.createElement('canvas');"
        + "var g=c.getContext('webgl2')||c.getContext('webgl');"
        + "if(!g){var w=document.createElement('div');"
        + "w.style.cssText='position:fixed;bottom:74px;left:0;right:0;z-index:99999;"
        + "background:#4a1020;color:#ffb3c0;font:12px monospace;padding:8px;text-align:center';"
        + "w.textContent='WebGL unavailable — Android System WebView update karo (Play Store)';"
        + "document.body.appendChild(w);}}catch(e){}})()";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        android.content.pm.PackageInfo wvPkg = android.webkit.WebView.getCurrentWebViewPackage();
        String wvVersion = (wvPkg != null && wvPkg.versionName != null) ? wvPkg.versionName : "unknown";
        Toast.makeText(this, "THIRD EYE v1.4 · WebView " + wvVersion, Toast.LENGTH_LONG).show();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0A0A0F"));
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(false);
        s.setLoadWithOverviewMode(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportZoom(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " ThirdEyeApp/1.6");
        if (Build.VERSION.SDK_INT >= 26) {
            s.setSafeBrowsingEnabled(true);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            // Full renderer priority while visible — OEM WebView throttling
            // is a top cause of a blank WebGL globe.
            webView.setRendererPriorityPolicy(
                WebView.RENDERER_PRIORITY_IMPORTANT, true);
        }

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(null, ERROR_HTML, "text/html", "utf-8", null);
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.evaluateJavascript(GL_PROBE_JS, null);
            }
        });

        applyImmersive();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_URL);
        }
    }

    private void applyImmersive() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
EOF

python3 << 'PYEOF'
import zlib, struct, math, os
W = 192
px = bytearray()
cx, cy = W/2, W/2
for y in range(W):
    px.append(0)
    for x in range(W):
        d = math.hypot(x-cx, y-cy)
        if x < 6 or x > W-7 or y < 6 or y > W-7: px += bytes((8,14,24))
        elif d > 70: px += bytes((11,22,38))
        elif d > 58: px += bytes((40,199,255))
        elif d > 46: px += bytes((16,60,84))
        elif d > 18: px += bytes((230,244,252))
        elif d > 9: px += bytes((255,164,27))
        else: px += bytes((10,16,28))
def chunk(t, data):
    c = struct.pack('>I', len(data)) + t + data
    return c + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, W, 8, 2, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(px), 9))
png += chunk(b'IEND', b'')
open('app/src/main/res/drawable/ic_eye.png', 'wb').write(png)
print('icon OK')
PYEOF

echo "sdk.dir=$AB/sdk" > local.properties

echo "== 3) build =="
export JAVA_HOME=$AB/jdk17
export ANDROID_HOME=$AB/sdk
export GRADLE_USER_HOME=$AB/gradle-home
cd $APP
$AB/gradle/bin/gradle assembleRelease --no-daemon 2>&1 | tail -3

echo "== 4) align + sign =="
export PATH=$JAVA_HOME/bin:$PATH
$BT/zipalign -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk /tmp/aligned.apk
$BT/apksigner sign --ks /home/user/Third-Eye-release.keystore \
  --ks-pass pass:thirdeye2026 --key-pass pass:thirdeye2026 \
  --out /home/user/ThirdEye.apk /tmp/aligned.apk
$BT/apksigner verify /home/user/ThirdEye.apk && echo "SIGNED ✓"
$BT/aapt dump badging /home/user/ThirdEye.apk 2>/dev/null | grep -E "package:|application-label:"
ls -la /home/user/ThirdEye.apk
