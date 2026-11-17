import { destroySession, getSessionUser, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const user = await getSessionUser();
  await destroySession();
  return { ok: true, user: user?.username ?? null };
});
