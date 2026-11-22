package ir.hamdel.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * سرویس پیش‌زمینه‌ی کلاس آنلاین.
 * تا وقتی کلاس باز است، سیستم برنامه را متوقف یا «منجمد» نمی‌کند؛ بنابراین صدای مدرس و
 * دانش‌آموزان و تصویر دوربین/صفحه در پس‌زمینه ادامه دارد. نوع سرویس بر اساس مجوزهای داده‌شده تعیین می‌شود
 * (Android 14+ برای میکروفون، دوربین و پخش رسانه، نوع و مجوز جدا لازم دارد).
 */
public class ClassroomService extends Service {

    static final String ACTION_START = "ir.hamdel.app.CLASS_START";
    static final String ACTION_STOP = "ir.hamdel.app.CLASS_STOP";

    private static final int NOTIF_ID = 4418;
    private static final String CHANNEL_ID = "classroom";
    /** حداکثر مدت قفل بیدارباش (ساعت) — کلاس‌ها کمتر از این طول می‌کشند */
    private static final long WAKE_MS = 6L * 60 * 60 * 1000;

    /** true وقتی سرویس در حال اجراست؛ MainActivity از آن برای نگه داشتن WebView در پس‌زمینه استفاده می‌کند */
    static volatile boolean active = false;

    private PowerManager.WakeLock wake;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        ensureChannel();

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("کلاس آنلاین در حال برگزاری")
                .setContentText("صدا و تصویر کلاس در پس‌زمینه ادامه دارد")
                .setSmallIcon(getApplicationInfo().icon)
                .setContentIntent(pi)
                .setOngoing(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .build();

        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_ID, notification, foregroundTypes());
            } else {
                startForeground(NOTIF_ID, notification);
            }
        } catch (SecurityException | IllegalStateException e) {
            // مجوز یکی از نوع‌ها هنوز داده نشده: دست‌کم با نوع پخش رسانه ادامه می‌دهیم
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(NOTIF_ID, notification);
                }
            } catch (RuntimeException again) {
                stopSelf();
                return START_NOT_STICKY;
            }
        }

        acquireWake();
        active = true;
        return START_NOT_STICKY;
    }

    /** نوع‌های پیش‌زمینه فقط برای مجوزهای داده‌شده؛ هر بار کلاس تغییر کند دوباره صدا زده می‌شود */
    private int foregroundTypes() {
        int types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
        if (Build.VERSION.SDK_INT >= 30) {
            if (granted(Manifest.permission.RECORD_AUDIO)) {
                types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            }
            if (granted(Manifest.permission.CAMERA)) {
                types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            }
        }
        return types;
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void acquireWake() {
        if (wake != null && wake.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "hamdel:classroom");
        wake.acquire(WAKE_MS);
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "کلاس آنلاین", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("وضعیت کلاس آنلاین در پس‌زمینه");
        nm.createNotificationChannel(ch);
    }

    @Override
    public void onDestroy() {
        active = false;
        if (wake != null && wake.isHeld()) wake.release();
        wake = null;
        stopForeground(true);
        super.onDestroy();
    }
}
