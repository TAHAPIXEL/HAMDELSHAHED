import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { classes, messages, users } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route } from "@/lib/api";
import { accessibleClassIds, assertClassAccess, canManageClass } from "@/lib/access";
import { deleteStoredImages, sanitizeImageUrl } from "@/lib/storage";
import { assertDeletePassword, getSetting } from "@/lib/settings";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

type Scope = "direct" | "class" | "staff";

export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const db = await getDb();
  const scope = (req.nextUrl.searchParams.get("scope") ?? "class") as Scope;
  const limit = Math.min(num(req.nextUrl.searchParams.get("limit") ?? 120, "limit"), 250);

  const classIds = await accessibleClassIds(user);

  if (scope === "direct") {
    const peerParam = req.nextUrl.searchParams.get("peerId");
    if (!peerParam) {
      const rows = await db
        .select({
          id: messages.id,
          body: messages.body,
          imageUrl: messages.imageUrl,
          createdAt: messages.createdAt,
          readAt: messages.readAt,
          senderId: messages.senderId,
          recipientId: messages.recipientId,
          peerId: sql<number>`case when ${qc(messages.senderId)} = ${user.id} then ${qc(messages.recipientId)} else ${qc(messages.senderId)} end`,
          peerName: sql<string>`case when ${qc(messages.senderId)} = ${user.id} then (select full_name from ${users} u where u.id = ${qc(messages.recipientId)}) else (select full_name from ${users} u where u.id = ${qc(messages.senderId)}) end`,
          peerColor: sql<string>`case when ${qc(messages.senderId)} = ${user.id} then (select avatar_color from ${users} u where u.id = ${qc(messages.recipientId)}) else (select avatar_color from ${users} u where u.id = ${qc(messages.senderId)}) end`,
          peerAvatar: sql<string | null>`case when ${qc(messages.senderId)} = ${user.id} then (select avatar_url from ${users} u where u.id = ${qc(messages.recipientId)}) else (select avatar_url from ${users} u where u.id = ${qc(messages.senderId)}) end`,
          unread: sql<number>`case when ${qc(messages.recipientId)} = ${user.id} and ${qc(messages.readAt)} is null then 1 else 0 end`,
        })
        .from(messages)
        .where(
          and(
            eq(messages.scope, "direct"),
            or(eq(messages.senderId, user.id), eq(messages.recipientId, user.id)),
          ),
        )
        .orderBy(desc(messages.createdAt));

      const unreadPerPeer = new Map<number, number>();
      for (const row of rows) {
        if (row.peerId && row.unread) {
          unreadPerPeer.set(row.peerId, (unreadPerPeer.get(row.peerId) ?? 0) + 1);
        }
      }

      const seen = new Set<number>();
      const threads = [];
      for (const row of rows) {
        if (!row.peerId || !row.peerName || seen.has(row.peerId)) continue;
        seen.add(row.peerId);
        threads.push({
          peerId: row.peerId,
          peerName: row.peerName,
          peerColor: row.peerColor || "#6366f1",
          peerAvatar: row.peerAvatar ?? null,
          lastMessage: row.body || (row.imageUrl ? "📷 تصویر" : ""),
          hasImage: Boolean(row.imageUrl),
          lastAt: row.createdAt.toISOString(),
          unreadCount: unreadPerPeer.get(row.peerId) ?? 0,
        });
        if (threads.length >= 50) break;
      }

      const unread = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.scope, "direct"),
            eq(messages.recipientId, user.id),
            isNull(messages.readAt),
          ),
        );

      return { scope, threads, unread: unread[0]?.n ?? 0 };
    }

    const peerId = num(peerParam, "مخاطب");
    const rows = await db
      .select({
        id: messages.id,
        body: messages.body,
        imageUrl: messages.imageUrl,
        createdAt: messages.createdAt,
        readAt: messages.readAt,
        senderId: messages.senderId,
        senderName: users.fullName,
        senderColor: users.avatarColor,
        senderAvatar: users.avatarUrl,
        senderRole: users.role,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(
        and(
          eq(messages.scope, "direct"),
          or(
            and(eq(messages.senderId, user.id), eq(messages.recipientId, peerId)),
            and(eq(messages.senderId, peerId), eq(messages.recipientId, user.id)),
          ),
        ),
      )
      .orderBy(asc(messages.createdAt))
      .limit(limit);

    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(messages.scope, "direct"),
          eq(messages.senderId, peerId),
          eq(messages.recipientId, user.id),
          isNull(messages.readAt),
        ),
      );

    const [peer] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        avatarColor: users.avatarColor,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
      })
      .from(users)
      .where(eq(users.id, peerId))
      .limit(1);

    return {
      scope,
      peer: peer ?? null,
      items: rows.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        readAt: m.readAt?.toISOString() ?? null,
        mine: m.senderId === user.id,
      })),
    };
  }

  if (scope === "staff") {
    if (user.role === "student") throw new ApiError("دسترسی ندارید", 403);
    const rows = await db
      .select({
        id: messages.id,
        body: messages.body,
        imageUrl: messages.imageUrl,
        createdAt: messages.createdAt,
        senderId: messages.senderId,
        senderName: users.fullName,
        senderColor: users.avatarColor,
        senderAvatar: users.avatarUrl,
        senderRole: users.role,
      })
      .from(messages)
      .innerJoin(users, eq(users.id, messages.senderId))
      .where(eq(messages.scope, "staff"))
      .orderBy(asc(messages.createdAt))
      .limit(limit);
    return {
      scope,
      items: rows.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        mine: m.senderId === user.id,
      })),
    };
  }

  // گفت‌وگوی کلاسی
  const classParam = req.nextUrl.searchParams.get("classId");
  const targetClassId = classParam ? num(classParam, "کلاس") : classIds[0];
  if (!targetClassId) return { scope, classId: null, classes: [], items: [] };
  await assertClassAccess(user, targetClassId);

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      imageUrl: messages.imageUrl,
      createdAt: messages.createdAt,
      senderId: messages.senderId,
      senderName: users.fullName,
      senderColor: users.avatarColor,
      senderAvatar: users.avatarUrl,
      senderRole: users.role,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.senderId))
    .where(and(eq(messages.scope, "class"), eq(messages.classId, targetClassId)))
    .orderBy(asc(messages.createdAt))
    .limit(limit);

  const classRows = classIds.length
    ? await db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(inArray(classes.id, classIds))
    : [];

  return {
    scope,
    classId: targetClassId,
    classes: classRows,
    items: rows.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
      mine: m.senderId === user.id,
    })),
  };
});

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "scope",
    "body",
    "imageUrl",
    "classId",
    "recipientId",
  ]);

  const rawBody = typeof payload.body === "string" ? payload.body.trim() : "";
  if (rawBody.length > 4000) {
    throw new ApiError("متن پیام بیش از حد طولانی است (حداکثر ۴۰۰۰ کاراکتر)", 400);
  }
  const imageUrl = sanitizeImageUrl(payload.imageUrl);
  if (!rawBody && !imageUrl) {
    throw new ApiError("متن پیام یا تصویر را وارد کنید", 400);
  }

  const scope = String(payload.scope ?? "class") as Scope;
  const db = await getDb();

  if (scope === "class") {
    const classId = num(payload.classId, "کلاس");
    await assertClassAccess(user, classId);
    const [row] = await db
      .insert(messages)
      .values({ senderId: user.id, scope: "class", classId, body: rawBody, imageUrl })
      .returning();
    return { item: { ...row, createdAt: row.createdAt.toISOString(), mine: true } };
  }

  if (scope === "staff") {
    if (user.role === "student") throw new ApiError("دسترسی ندارید", 403);
    const [row] = await db
      .insert(messages)
      .values({ senderId: user.id, scope: "staff", body: rawBody, imageUrl })
      .returning();
    return { item: { ...row, createdAt: row.createdAt.toISOString(), mine: true } };
  }

  const recipientId = num(payload.recipientId, "مخاطب");
  if (recipientId === user.id) throw new ApiError("نمی‌توانید به خودتان پیام بدهید", 400);
  const [recipient] = await db
    .select({ id: users.id, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, recipientId))
    .limit(1);
  if (!recipient || !recipient.isActive) throw new ApiError("مخاطب یافت نشد", 404);

  if (user.role === "student" && recipient.role === "student") {
    const allow = await getSetting("allow_student_dm");
    if (allow !== "true") {
      throw new ApiError("گفت‌وگوی مستقیم دانش‌آموزان با یکدیگر فعال نیست", 403);
    }
  }

  const [row] = await db
    .insert(messages)
    .values({ senderId: user.id, scope: "direct", recipientId, body: rawBody, imageUrl })
    .returning();
  return { item: { ...row, createdAt: row.createdAt.toISOString(), mine: true } };
});

/** حذف یک پیام یا پاک‌سازی کل یک گفت‌وگو (با بررسی دسترسی و رمز حذف برای پاک‌سازی) */
export const DELETE = route(async (req: NextRequest) => {
  const user = await requireUser();
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const idParam = req.nextUrl.searchParams.get("id") ?? payload.id;
  const clearScope = req.nextUrl.searchParams.get("clearScope") ?? payload.clearScope;
  const db = await getDb();

  // پاک‌سازی کامل یک اتاق گفت‌وگو (نیازمند مدیر + رمز حذف)
  if (clearScope) {
    if (user.role !== "admin") throw new ApiError("فقط مدیر می‌تواند کل گفت‌وگو را پاک کند", 403);
    await assertDeletePassword(payload.deletePassword);

    if (clearScope === "class") {
      const classId = num(payload.classId ?? req.nextUrl.searchParams.get("classId"), "کلاس");
      const toRemove = await db
        .select({ imageUrl: messages.imageUrl })
        .from(messages)
        .where(and(eq(messages.scope, "class"), eq(messages.classId, classId)));
      await db
        .delete(messages)
        .where(and(eq(messages.scope, "class"), eq(messages.classId, classId)));
      await deleteStoredImages(toRemove.map((r) => r.imageUrl));
      await audit(user.id, "clear", "messages", classId, { scope: "class" });
      return { ok: true };
    }

    if (clearScope === "staff") {
      const toRemove = await db
        .select({ imageUrl: messages.imageUrl })
        .from(messages)
        .where(eq(messages.scope, "staff"));
      await db.delete(messages).where(eq(messages.scope, "staff"));
      await deleteStoredImages(toRemove.map((r) => r.imageUrl));
      await audit(user.id, "clear", "messages", null, { scope: "staff" });
      return { ok: true };
    }

    throw new ApiError("نوع گفت‌وگو نامعتبر است", 400);
  }

  // حذف تک‌پیام
  const id = num(idParam, "شناسه‌ی پیام");
  const [msg] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  if (!msg) throw new ApiError("پیام یافت نشد", 404);

  const isOwn = msg.senderId === user.id;
  const isClassManager =
    msg.scope === "class" && msg.classId ? await canManageClass(user, msg.classId) : false;

  if (!isOwn && user.role !== "admin" && !isClassManager) {
    throw new ApiError("شما اجازه‌ی حذف این پیام را ندارید", 403);
  }

  // حذف پیام دیگران توسط مدیر یا دبیر نیازمند رمز حذف است
  if (!isOwn) {
    await assertDeletePassword(payload.deletePassword);
  }

  await db.delete(messages).where(eq(messages.id, id));
  if (msg.imageUrl) {
    await deleteStoredImages([msg.imageUrl]);
  }
  await audit(user.id, "delete", "message", id, { own: isOwn });
  return { ok: true };
});

export const revalidate = 0;
