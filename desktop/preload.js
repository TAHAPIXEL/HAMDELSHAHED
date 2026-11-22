// پل امن بین صفحه‌ی سایت و اپ ویندوز. فقط یک پرچم ساده در اختیار سایت می‌گذارد.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("hamdelDesktop", {
  isDesktop: true,
  platform: process.platform,
});
