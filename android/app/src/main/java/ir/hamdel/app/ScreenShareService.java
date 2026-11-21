package ir.hamdel.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Base64;
import android.util.DisplayMetrics;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * سرویس پیش‌زمینه برای ضبط صفحه‌ی گوشی با MediaProjection.
 * Android 14+ الزام دارد که این سرویس با نوع mediaProjection پیش از گرفتن توکن اجرا شود.
 */
public class ScreenShareService extends Service {

    static final String ACTION_START = "ir.hamdel.app.SCREEN_START";
    static final String ACTION_STOP = "ir.hamdel.app.SCREEN_STOP";
    static final String EXTRA_CODE = "code";
    static final String EXTRA_DATA = "data";

    private static final int NOTIF_ID = 4417;
    private static final String CHANNEL_ID = "screen-share";
    /** کوچک‌ترین ضلع تصویر ارسالی (پیکسل) */
    private static final int SHORT_SIDE = 720;
    /** حداقل فاصله‌ی بین دو فریم (میلی‌ثانیه)، حدود ۶ فریم در ثانیه */
    private static final long FRAME_INTERVAL_MS = 160;
    private static final int JPEG_QUALITY = 62;

    /** پل به افزونه؛ توسط ScreenSharePlugin.load() تنظیم می‌شود */
    static volatile ScreenSharePlugin listener;

    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader reader;
    private HandlerThread worker;
    private volatile boolean running = false;
    private long lastFrameAt = 0;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startForegroundCompat();

        int code = intent.getIntExtra(EXTRA_CODE, 0);
        Intent data = Build.VERSION.SDK_INT >= 33
                ? intent.getParcelableExtra(EXTRA_DATA, Intent.class)
                : intent.getParcelableExtra(EXTRA_DATA);
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (data == null || mpm == null) {
            fail("ضبط صفحه شروع نشد.");
            return START_NOT_STICKY;
        }
        try {
            stopCapture();
            projection = mpm.getMediaProjection(code, data);
            if (projection == null) {
                fail("ضبط صفحه شروع نشد.");
                return START_NOT_STICKY;
            }
            // روی Android 14+ باید پیش از ساخت VirtualDisplay ثبت شود
            projection.registerCallback(new MediaProjection.Callback() {
                @Override
                public void onStop() {
                    if (running) {
                        stopCapture();
                        emitEnded();
                        stopSelf();
                    }
                }
            }, new Handler(Looper.getMainLooper()));
            startCapture();
        } catch (Exception e) {
            fail("ضبط صفحه شروع نشد: " + e.getMessage());
            return START_NOT_STICKY;
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        stopCapture();
        super.onDestroy();
    }

    private void startForegroundCompat() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "اشتراک صفحه", NotificationManager.IMPORTANCE_LOW));
            b = new Notification.Builder(this, CHANNEL_ID);
        } else {
            b = new Notification.Builder(this);
        }
        Notification n = b.setContentTitle("هَمدِل")
                .setContentText("در حال نشان دادن صفحه‌ی گوشی در کلاس")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private void startCapture() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int shortSide = Math.min(dm.widthPixels, dm.heightPixels);
        float scale = Math.min(1f, SHORT_SIDE / (float) shortSide);
        int w = even(Math.round(dm.widthPixels * scale));
        int h = even(Math.round(dm.heightPixels * scale));

        worker = new HandlerThread("screen-frames");
        worker.start();
        Handler handler = new Handler(worker.getLooper());

        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2);
        reader.setOnImageAvailableListener(this::onImage, handler);
        virtualDisplay = projection.createVirtualDisplay(
                "hamdel-screen", w, h, dm.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.getSurface(), null, handler);
        running = true;
    }

    private void onImage(ImageReader r) {
        Image img = null;
        try {
            img = r.acquireLatestImage();
            if (img == null) return;
            long now = SystemClock.elapsedRealtime();
            if (now - lastFrameAt < FRAME_INTERVAL_MS) return;
            lastFrameAt = now;

            Bitmap bmp = toBitmap(img);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out);
            String b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            ScreenSharePlugin l = listener;
            if (l != null) l.onFrame(b64);
        } catch (Exception ignored) {
            // یک فریم خراب مهم نیست؛ فریم بعدی ارسال می‌شود
        } finally {
            if (img != null) img.close();
        }
    }

    private static Bitmap toBitmap(Image img) {
        Image.Plane plane = img.getPlanes()[0];
        ByteBuffer buffer = plane.getBuffer();
        int pixelStride = plane.getPixelStride();
        int rowPadding = plane.getRowStride() - pixelStride * img.getWidth();
        Bitmap raw = Bitmap.createBitmap(img.getWidth() + rowPadding / pixelStride, img.getHeight(), Bitmap.Config.ARGB_8888);
        raw.copyPixelsFromBuffer(buffer);
        if (raw.getWidth() == img.getWidth()) return raw;
        return Bitmap.createBitmap(raw, 0, 0, img.getWidth(), img.getHeight());
    }

    private void stopCapture() {
        running = false;
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (reader != null) {
            reader.setOnImageAvailableListener(null, null);
            reader.close();
            reader = null;
        }
        if (projection != null) {
            MediaProjection p = projection;
            projection = null;
            p.stop();
        }
        if (worker != null) {
            worker.quitSafely();
            worker = null;
        }
    }

    private void fail(String message) {
        ScreenSharePlugin l = listener;
        if (l != null) l.onError(message);
        stopSelf();
    }

    private void emitEnded() {
        ScreenSharePlugin l = listener;
        if (l != null) l.onEnded();
    }

    private static int even(int v) {
        return Math.max(2, v - (v % 2));
    }
}
