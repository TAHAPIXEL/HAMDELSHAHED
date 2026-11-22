package ir.hamdel.app;

import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** پل وب به سرویس پیش‌زمینه‌ی کلاس: وقتی کلاس شروع یا تمام می‌شود فراخوانی می‌شود */
@CapacitorPlugin(name = "ClassroomKeepAlive")
public class ClassroomPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        Intent i = new Intent(getContext(), ClassroomService.class);
        i.setAction(ClassroomService.ACTION_START);
        try {
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (RuntimeException e) {
            // مثلاً برنامه در پس‌زمینه است و سیستم اجازه‌ی شروع سرویس نمی‌دهد؛ کلاس بدون آن ادامه می‌یابد
            call.reject("سرویس پس‌زمینه‌ی کلاس اجرا نشد: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        // توقف مستقیم؛ نباید با startForegroundService فرستاده شود (سیستم انتظار startForeground دارد)
        getContext().stopService(new Intent(getContext(), ClassroomService.class));
        call.resolve();
    }
}
