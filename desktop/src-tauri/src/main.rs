// اپ ویندوز هَمدِل: پنجره‌ی Tauri که نسخه‌ی زنده‌ی سایت را نشان می‌دهد.
// هیچ دستور بومی (command) در اختیار سایت گذاشته نشده است. ناوبری فقط روی دامنه‌ی سایت مجاز است.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::window::Color;
use tauri::{Url, WebviewUrl, WebviewWindowBuilder};

const APP_HOST: &str = "hamdelshahed.vercel.app";
const APP_URL: &str = "https://hamdelshahed.vercel.app/";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let url = Url::parse(APP_URL).expect("آدرس سایت نامعتبر است");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("هَمدِل • HAMDEL")
                .inner_size(1280.0, 820.0)
                .min_inner_size(360.0, 560.0)
                .center()
                .background_color(Color(22, 22, 22, 255))
                // فقط خود سایت در این پنجره باز شود؛ بقیه‌ی آدرس‌ها بارگذاری نمی‌شوند
                .on_navigation(|nav: &Url| nav.scheme() == "https" && nav.host_str() == Some(APP_HOST))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("اجرای اپ هَمدِل ناموفق بود");
}
