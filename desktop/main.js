// اپ ویندوز هَمدِل: پوسته‌ی Electron که نسخه‌ی زنده‌ی سایت را نشان می‌دهد.
// هر تغییر وب بدون ساخت مجدد اپ به کاربر می‌رسد؛ فقط کد این پوشه نیاز به ساخت نصب‌کننده دارد.
const path = require("node:path");
const { app, BrowserWindow, session, shell, desktopCapturer } = require("electron");

const APP_URL = "https://hamdelshahed.vercel.app/";
const APP_ORIGIN = new URL(APP_URL).origin;

// فقط مجوزهای لازم برای کلاس آنلاین و گفتگو، و فقط برای خود سایت
const ALLOWED_PERMISSIONS = new Set([
  "media", // میکروفون و دوربین
  "display-capture", // اشتراک صفحه
  "notifications",
  "fullscreen",
  "clipboard-sanitized-write",
]);

function isAppUrl(url) {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

// یک نمونه‌ی اپ در حال اجرا؛ دومین اجرا همان پنجره را جلو می‌آورد
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: "هَمدِل • HAMDEL",
    icon: path.join(__dirname, "assets", "icon.png"),
    backgroundColor: "#161616",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once("ready-to-show", () => win.show());

  // ناوبری بیرون از سایت ممنوع؛ لینک‌های بیرونی در مرورگر پیش‌فرض باز می‌شوند
  win.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // اگر سایت بارگذاری نشد، صفحه‌ی آفلاین با دکمه‌ی تلاش دوباره نشان داده می‌شود
  win.webContents.on("did-fail-load", (_event, _code, _desc, url, isMainFrame) => {
    if (isMainFrame && isAppUrl(url)) {
      win.loadFile(path.join(__dirname, "offline.html"));
    }
  });

  win.loadURL(APP_URL);
  win.on("closed", () => {
    win = null;
  });
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details?.requestingUrl ? new URL(details.requestingUrl).origin : webContents.getURL();
    callback(origin === APP_ORIGIN && ALLOWED_PERMISSIONS.has(permission));
  });
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return requestingOrigin === APP_ORIGIN && ALLOWED_PERMISSIONS.has(permission);
  });

  // اشتراک صفحه: نمایشگر اصلی به‌صورت خودکار انتخاب می‌شود؛ صدای سیستم در صورت درخواست ارسال می‌شود
  ses.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ["screen"] });
        const screen = sources[0];
        if (!screen) return callback({});
        callback(request.audioRequested ? { video: screen, audio: "loopback" } : { video: screen });
      } catch {
        callback({});
      }
    },
    { useSystemPicker: false },
  );

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
