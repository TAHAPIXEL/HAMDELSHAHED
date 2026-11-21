package ir.hamdel.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // افزونه‌ی اشتراک صفحه باید پیش از ساخت پل Capacitor ثبت شود
        registerPlugin(ScreenSharePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
