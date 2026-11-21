"use client";

import { useEffect, useState } from "react";
import { currentUser, ensureSeed, logout, restoreSession, type User } from "@/lib/model";
import { Splash, ToastProvider } from "@/components/ui";
import Auth from "@/components/Auth";
import Shell from "@/components/Shell";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let alive = true;
    const minSplash = new Promise((r) => setTimeout(r, 1400));
    (async () => {
      try {
        await restoreSession();
        ensureSeed();
      } catch (err) {
        if (alive) setLoadError((err as Error).message);
      }
      await minSplash;
      if (alive) {
        setUser(currentUser());
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  // «تلاش دوباره» نشست ذخیره‌شده را پاک می‌کند و صفحه‌ی ورود را نشان می‌دهد
  // (بارگذاری مجدد با همان نشست نامعتبر، همان خطا را دوباره می‌آورد).
  const retryToLogin = () => {
    setLoadError("");
    handleLogout();
  };

  return (
    <ToastProvider>
      {!ready ? (
        <Splash />
      ) : loadError ? (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-sm font-bold text-rose-600">{loadError}</p>
          <button className="btn-primary" onClick={retryToLogin}>
            تلاش دوباره
          </button>
        </div>
      ) : user ? (
        <Shell user={user} onLogout={handleLogout} />
      ) : (
        <Auth onAuth={(u) => setUser(u)} />
      )}
    </ToastProvider>
  );
}
