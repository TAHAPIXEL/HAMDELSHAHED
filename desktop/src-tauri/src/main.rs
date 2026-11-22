// اپ ویندوز هَمدِل: پنجره‌ی Tauri که نسخه‌ی زنده‌ی سایت را نشان می‌دهد.
// هیچ دستور بومی (command) در اختیار سایت گذاشته نشده است. ناوبری فقط روی دامنه‌ی سایت مجاز است.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

const APP_HOST: &str = "hamdelshahed.vercel.app";

fn main() {
    tauri::Builder::default()
        .on_navigation(|url| {
            // فقط خود سایت در این پنجره باز شود؛ بقیه‌ی آدرس‌ها بارگذاری نمی‌شوند
            url.scheme() == "https" && url.host_str() == Some(APP_HOST)
        })
        .run(tauri::generate_context!())
        .expect("اجرای اپ هَمدِل ناموفق بود");
}
