package ir.hamdel.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * پل بین صفحه‌ی وب و ضبط صفحه‌ی گوشی.
 * فریم‌های JPEG به صورت رویداد "frame" (فیلد data، base64) به وب ارسال می‌شوند.
 */
@CapacitorPlugin(name = "ScreenShare")
public class ScreenSharePlugin extends Plugin {

    @Override
    public void load() {
        ScreenShareService.listener = this;
    }

    @PluginMethod
    public void start(PluginCall call) {
        MediaProjectionManager mpm = (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            call.reject("این دستگاه از اشتراک صفحه پشتیبانی نمی‌کند.");
            return;
        }
        startActivityForResult(call, mpm.createScreenCaptureIntent(), "onProjection");
    }

    @ActivityCallback
    private void onProjection(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("اجازه‌ی اشتراک صفحه داده نشد.");
            return;
        }
        Intent svc = new Intent(getContext(), ScreenShareService.class);
        svc.setAction(ScreenShareService.ACTION_START);
        svc.putExtra(ScreenShareService.EXTRA_CODE, result.getResultCode());
        svc.putExtra(ScreenShareService.EXTRA_DATA, result.getData());
        ContextCompat.startForegroundService(getContext(), svc);
        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ScreenShareService.class));
        call.resolve();
    }

    /** از سرویس فراخوانی می‌شود (نخ پس‌زمینه) */
    void onFrame(String base64Jpeg) {
        getActivity().runOnUiThread(() -> {
            JSObject o = new JSObject();
            o.put("data", base64Jpeg);
            notifyListeners("frame", o);
        });
    }

    void onEnded() {
        getActivity().runOnUiThread(() -> notifyListeners("ended", new JSObject()));
    }

    void onError(String message) {
        getActivity().runOnUiThread(() -> {
            JSObject o = new JSObject();
            o.put("message", message);
            notifyListeners("error", o);
        });
    }
}
