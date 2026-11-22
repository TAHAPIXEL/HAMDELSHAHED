package ir.hamdel.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // افزونه‌ها باید پیش از ساخت پل Capacitor ثبت شوند
        registerPlugin(ScreenSharePlugin.class);
        registerPlugin(ClassroomPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * وقتی کلاس زنده است، WebView نباید با رفتن به پس‌زمینه متوقف شود:
     * تایمرها و پخش/ضبط رسانه‌ی صفحه‌ی کلاس ادامه می‌یابند (سرویس پیش‌زمینه مانع قطع فرایند می‌شود).
     */
    @Override
    protected void onPause() {
        super.onPause();
        if (ClassroomService.active && getBridge() != null) {
            WebView wv = getBridge().getWebView();
            if (wv != null) {
                wv.onResume();
                wv.resumeTimers();
            }
        }
    }
}
