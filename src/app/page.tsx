"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Me } from "@/lib/types";
import { Splash, ToastProvider } from "@/components/ui";
import Auth from "@/components/Auth";
import Shell from "@/components/Shell";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      try {
        const result = await api<{ user: Me | null }>("/api/me");
        if (!cancelled) setUser(result.user);
      } catch {
        /* نبود نشست خطا نیست */
      } finally {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, 800 - elapsed);
        setTimeout(() => {
          if (!cancelled) setReady(true);
        }, wait);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ToastProvider>
      {!ready ? (
        <Splash />
      ) : user ? (
        <Shell
          user={user}
          onUserUpdated={(next) => setUser(next)}
          onLogout={() => setUser(null)}
        />
      ) : (
        <Auth onAuth={(next) => setUser(next)} />
      )}
    </ToastProvider>
  );
}
