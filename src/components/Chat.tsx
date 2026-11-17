"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  MessagesSquare,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  UserRound,
  X,
} from "lucide-react";
import { api, errorMessage, uploadImage, useApi } from "@/lib/client";
import { fa, clockTime, jalaliDate, timeAgo } from "@/lib/format";
import type { Me, MessageItem, Thread } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  DeleteConfirmModal,
  EmptyState,
  ImageAttachment,
  Input,
  Modal,
  useToast,
} from "./ui";
import type { Meta } from "./Shell";

type Mode = "class" | "direct" | "staff";

type PeerState = {
  id: number;
  fullName: string;
  avatarColor: string;
  avatarUrl?: string | null;
};

export default function Chat({ user }: { user: Me }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("class");
  const { data: meta, loading: metaLoading } = useApi<Meta>("/api/meta");
  const [classId, setClassId] = useState<string>("");
  const [peer, setPeer] = useState<PeerState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: "message"; id: number }
    | { kind: "clear"; scope: "class" | "staff"; classId?: number }
    | null
  >(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const classes = meta?.classes ?? [];
  const activeClassId = classId || (classes[0] ? String(classes[0].id) : "");

  const classPath =
    mode === "class" && activeClassId ? `/api/messages?scope=class&classId=${activeClassId}` : null;
  const directPath = mode === "direct" && peer ? `/api/messages?scope=direct&peerId=${peer.id}` : null;
  const staffPath = mode === "staff" ? "/api/messages?scope=staff" : null;

  const conversationPath = classPath ?? directPath ?? staffPath;

  const { data: conversation, reload: reloadConversation } = useApi<{
    items: MessageItem[];
    classId?: number;
  }>(conversationPath, { refreshMs: 4500 });

  const { data: threads, reload: reloadThreads } = useApi<{
    threads: Thread[];
    unread: number;
  }>(mode === "direct" ? "/api/messages?scope=direct" : null, { refreshMs: 7000 });

  const messages = useMemo(() => conversation?.items ?? [], [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, peer?.id, mode]);

  const handleImagePick = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImg(true);
    try {
      const url = await uploadImage(file, "messages");
      setAttachedImage(url);
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setUploadingImg(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleImagePick(file);
          return;
        }
      }
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text && !attachedImage) return;
    if (mode === "class" && !activeClassId) {
      toast.push("کلاسی برای شما تعریف نشده است", "error");
      return;
    }
    if (mode === "direct" && !peer) return;
    setSending(true);
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          scope: mode,
          body: text,
          imageUrl: attachedImage,
          classId: mode === "class" ? Number(activeClassId) : undefined,
          recipientId: mode === "direct" ? peer?.id : undefined,
        }),
      });
      setDraft("");
      setAttachedImage(null);
      await reloadConversation(true);
      if (mode === "direct") await reloadThreads(true);
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSending(false);
    }
  };

  const deleteOwnMessage = async (id: number) => {
    try {
      await api(`/api/messages?id=${id}`, { method: "DELETE" });
      toast.push("پیام حذف شد", "info");
      await reloadConversation(true);
    } catch (e) {
      toast.push(errorMessage(e), "error");
    }
  };

  const modeTabs = [
    { id: "class" as Mode, label: "گفت‌وگوی کلاس", icon: Users },
    { id: "direct" as Mode, label: "گفت‌وگوی مستقیم", icon: UserRound },
    ...(user.role !== "student"
      ? [{ id: "staff" as Mode, label: "همکاران", icon: MessagesSquare }]
      : []),
  ];

  const canModerate = user.role === "admin" || (user.role === "teacher" && mode === "class");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 sm:text-2xl">گفت‌وگو</h2>
          <p className="mt-1 text-xs text-slate-500">
            پیام‌ها و تصاویر ارسالی به‌صورت دائمی در پایگاه‌داده و فضای ابری ذخیره می‌شوند.
          </p>
        </div>
        {mode === "direct" && (
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <MessageSquarePlus className="size-4" /> گفت‌وگوی جدید
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* ستون کنار */}
        <aside className="card flex max-h-[72dvh] flex-col overflow-hidden">
          <div className="space-y-1.5 border-b border-slate-100 p-2">
            {modeTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id);
                  setPeer(null);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  mode === tab.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {mode === "class" && (
              <div className="space-y-1">
                <p className="px-2 py-1 text-[10px] font-bold text-slate-400">کلاس‌های شما</p>
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setClassId(String(cls.id))}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-right transition ${
                      String(cls.id) === activeClassId
                        ? "bg-slate-100 text-slate-800"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-indigo-100 text-[11px] font-black text-indigo-600">
                      {cls.name.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">{cls.name}</span>
                      <span className="block text-[10px] text-slate-400">
                        {fa(cls.studentCount ?? 0)} دانش‌آموز
                      </span>
                    </span>
                  </button>
                ))}
                {classes.length === 0 && (
                  <p className="px-2 py-4 text-center text-[11px] text-slate-400">
                    هنوز کلاسی تعریف نشده است
                  </p>
                )}
              </div>
            )}

            {mode === "direct" && (
              <div className="space-y-1">
                <p className="px-2 py-1 text-[10px] font-bold text-slate-400">
                  گفت‌وگوها {threads?.unread ? `(${fa(threads.unread)} خوانده‌نشده)` : ""}
                </p>
                {(threads?.threads ?? []).map((thread) => (
                  <button
                    key={thread.peerId}
                    type="button"
                    onClick={() =>
                      setPeer({
                        id: thread.peerId,
                        fullName: thread.peerName,
                        avatarColor: thread.peerColor,
                        avatarUrl: thread.peerAvatar,
                      })
                    }
                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-right transition ${
                      peer?.id === thread.peerId ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <Avatar
                      name={thread.peerName}
                      color={thread.peerColor}
                      src={thread.peerAvatar}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-slate-700">
                        {thread.peerName}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {thread.lastMessage}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[9px] text-slate-400">{timeAgo(thread.lastAt)}</span>
                      {(thread.unreadCount ?? 0) > 0 && (
                        <span className="grid min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
                          {fa(thread.unreadCount ?? 0)}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
                {(threads?.threads ?? []).length === 0 && (
                  <p className="px-2 py-4 text-center text-[11px] text-slate-400">
                    هنوز گفت‌وگویی ندارید
                  </p>
                )}
              </div>
            )}

            {mode === "staff" && (
              <div className="px-2 py-4 text-center text-[11px] leading-6 text-slate-400">
                این گفت‌وگو بین دبیران و مدیران مدرسه است.
              </div>
            )}
          </div>
        </aside>

        {/* پنجره گفت‌وگو */}
        <section className="card flex h-[72dvh] flex-col overflow-hidden">
          <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            {mode === "class" && (
              <>
                <span className="grid size-9 place-items-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Users className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">
                    {classes.find((c) => String(c.id) === activeClassId)?.name ?? "گفت‌وگوی کلاس"}
                  </p>
                  <p className="text-[10px] text-slate-400">همه‌ی اعضای کلاس عضو این گفت‌وگو هستند</p>
                </div>
                {user.role === "admin" && activeClassId && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "clear",
                        scope: "class",
                        classId: Number(activeClassId),
                      })
                    }
                    title="پاک‌سازی پیام‌های این کلاس"
                    className="mr-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </>
            )}
            {mode === "direct" &&
              (peer ? (
                <>
                  <Avatar
                    name={peer.fullName}
                    color={peer.avatarColor}
                    src={peer.avatarUrl}
                    size={36}
                  />
                  <div>
                    <p className="text-xs font-extrabold text-slate-800">{peer.fullName}</p>
                    <p className="text-[10px] text-emerald-500">گفت‌وگوی خصوصی</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPeer(null)}
                    className="mr-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
                    aria-label="بازگشت"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </>
              ) : (
                <p className="text-xs font-bold text-slate-500">یک گفت‌وگو انتخاب کنید</p>
              ))}
            {mode === "staff" && (
              <>
                <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-600">
                  <MessagesSquare className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">اتاق همکاران</p>
                  <p className="text-[10px] text-slate-400">دبیران و مدیران</p>
                </div>
                {user.role === "admin" && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ kind: "clear", scope: "staff" })}
                    title="پاک‌سازی اتاق همکاران"
                    className="mr-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </>
            )}
          </header>

          <div className="chat-bg flex-1 space-y-2 overflow-y-auto p-4">
            {metaLoading && !conversationPath && (
              <div className="space-y-3 p-2">
                <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-white/80" />
                <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-indigo-100/70" />
                <div className="h-10 w-3/5 animate-pulse rounded-2xl bg-white/80" />
              </div>
            )}
            {!metaLoading && !conversationPath && mode === "class" && (
              <EmptyState
                icon={<Users className="size-5" />}
                title="کلاسی فعال نیست"
                description={
                  user.role === "admin"
                    ? "از بخش «مدیریت سامانه ← کلاس‌ها» اولین کلاس مدرسه را ایجاد کنید."
                    : "هنوز به کلاسی افزوده نشده‌اید."
                }
              />
            )}
            {!conversationPath && mode === "direct" && (
              <EmptyState
                icon={<UserRound className="size-5" />}
                title="گفت‌وگویی باز نیست"
                description="از فهرست کنار یا دکمه‌ی گفت‌وگوی جدید، مخاطب را انتخاب کنید."
              />
            )}
            {conversationPath && messages.length === 0 && (
              <EmptyState
                icon={<MessagesSquare className="size-5" />}
                title="هنوز پیامی نیست"
                description="اولین پیام یا تصویر را ارسال کنید تا گفت‌وگو شروع شود."
              />
            )}
            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const showDate =
                !previous ||
                new Date(previous.createdAt).toDateString() !==
                  new Date(message.createdAt).toDateString();
              return (
                <div key={message.id}>
                  {showDate && (
                    <p className="my-3 text-center text-[10px] font-semibold text-slate-400">
                      {jalaliDate(message.createdAt)}
                    </p>
                  )}
                  <div
                    className={`group flex items-end gap-2 ${message.mine ? "flex-row-reverse" : ""}`}
                  >
                    {!message.mine && (
                      <Avatar
                        name={message.senderName ?? "؟"}
                        color={message.senderColor ?? "#94a3b8"}
                        src={message.senderAvatar}
                        size={28}
                      />
                    )}
                    <div className={`msg-in max-w-[78%] ${message.mine ? "items-end" : ""}`}>
                      {!message.mine && (
                        <p className="mb-0.5 flex items-center gap-1 px-1 text-[10px] font-bold text-slate-500">
                          {message.senderName}
                          {message.senderRole === "teacher" && <Badge tone="violet">دبیر</Badge>}
                          {message.senderRole === "admin" && <Badge tone="indigo">مدیر</Badge>}
                        </p>
                      )}
                      <div
                        className={`user-text px-3 py-2 text-xs leading-6 whitespace-pre-line shadow-sm ${
                          message.mine
                            ? "bubble-mine bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                            : "bubble-other border border-slate-100 bg-white text-slate-700"
                        }`}
                      >
                        {message.imageUrl && (
                          <div className={message.body ? "mb-2" : ""}>
                            <ImageAttachment
                              src={message.imageUrl}
                              alt="تصویر پیام"
                              className="max-h-64"
                            />
                          </div>
                        )}
                        {message.body}
                      </div>
                      <div
                        className={`mt-0.5 flex items-center gap-1.5 px-1 text-[9px] text-slate-400 ${
                          message.mine ? "flex-row-reverse" : ""
                        }`}
                      >
                        <span>
                          {clockTime(message.createdAt)}
                          {message.mine && message.readAt ? " · خوانده شد" : ""}
                        </span>
                        {(message.mine || canModerate) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (message.mine) void deleteOwnMessage(message.id);
                              else setDeleteTarget({ kind: "message", id: message.id });
                            }}
                            title="حذف پیام"
                            className="opacity-0 transition group-hover:opacity-100 hover:text-rose-500 focus:opacity-100"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <footer className="border-t border-slate-100 p-3">
            {attachedImage && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-indigo-50/70 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachedImage}
                  alt="پیوست"
                  className="size-14 rounded-lg object-cover ring-1 ring-indigo-200"
                />
                <span className="flex-1 text-[11px] font-semibold text-indigo-700">
                  تصویر آماده‌ی ارسال (می‌توانید توضیح هم بنویسید)
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="rounded-full p-1 text-slate-500 transition hover:bg-white hover:text-rose-600"
                  aria-label="حذف تصویر"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleImagePick(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={!conversationPath || uploadingImg}
                onClick={() => fileRef.current?.click()}
                title="ارسال عکس"
                className="grid size-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
              >
                {uploadingImg ? (
                  <Loader2 className="size-4.5 animate-spin text-indigo-500" />
                ) : (
                  <ImagePlus className="size-4.5" />
                )}
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={
                  conversationPath
                    ? "پیام بنویسید یا عکس بفرستید… (Enter برای ارسال)"
                    : "ابتدا گفت‌وگو را انتخاب کنید"
                }
                disabled={!conversationPath}
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
              />
              <Button
                onClick={send}
                loading={sending}
                disabled={
                  !conversationPath || uploadingImg || (!draft.trim() && !attachedImage)
                }
              >
                <Send className="size-4" />
                ارسال
              </Button>
            </div>
          </footer>
        </section>
      </div>

      <PeerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        meta={meta}
        userId={user.id}
        role={user.role}
        onPick={(person) => {
          setPeer(person);
          setMode("direct");
          setPickerOpen(false);
        }}
      />

      <DeleteConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.kind === "clear" ? "پاک‌سازی کامل گفت‌وگو" : "حذف پیام کاربر"}
        description={
          deleteTarget?.kind === "clear"
            ? "همه‌ی پیام‌ها و تصاویر این اتاق حذف می‌شوند. رمز حذف سامانه را وارد کنید."
            : "برای حذف پیام این کاربر، رمز حذف سامانه را وارد کنید."
        }
        onConfirm={async (deletePassword) => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "message") {
            await api("/api/messages", {
              method: "DELETE",
              body: JSON.stringify({ id: deleteTarget.id, deletePassword }),
            });
            toast.push("پیام حذف شد", "info");
          } else {
            await api("/api/messages", {
              method: "DELETE",
              body: JSON.stringify({
                clearScope: deleteTarget.scope,
                classId: deleteTarget.classId,
                deletePassword,
              }),
            });
            toast.push("گفت‌وگو پاک‌سازی شد", "info");
          }
          await reloadConversation(true);
        }}
      />
    </div>
  );
}

function PeerPicker({
  open,
  onClose,
  meta,
  userId,
  role,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  meta: Meta | null;
  userId: number;
  role: string;
  onPick: (person: PeerState) => void;
}) {
  const [query, setQuery] = useState("");
  const canStudentDm = Boolean(meta?.allowStudentDm);

  const people = useMemo(() => {
    const teachers = (meta?.teachers ?? [])
      .filter((t) => t.id !== userId)
      .map((t) => ({
        id: t.id,
        fullName: t.fullName,
        avatarColor: t.avatarColor,
        avatarUrl: t.avatarUrl,
        subtitle: t.role === "admin" ? "مدیر مدرسه" : "دبیر",
      }));
    const students =
      role === "student" && !canStudentDm
        ? []
        : (meta?.students ?? [])
            .filter((s) => s.id !== userId)
            .map((s) => ({
              id: s.id,
              fullName: s.fullName,
              avatarColor: s.avatarColor,
              avatarUrl: s.avatarUrl,
              subtitle: s.className ?? "دانش‌آموز",
            }));
    const all = [...teachers, ...students];
    if (!query.trim()) return all.slice(0, 80);
    return all.filter((p) => p.fullName.includes(query.trim())).slice(0, 80);
  }, [meta, userId, role, canStudentDm, query]);

  return (
    <Modal open={open} onClose={onClose} title="گفت‌وگوی جدید" subtitle="مخاطب مورد نظر را انتخاب کنید">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی نام…"
          className="pr-9"
        />
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => onPick(person)}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-right transition hover:bg-indigo-50"
          >
            <Avatar
              name={person.fullName}
              color={person.avatarColor}
              src={person.avatarUrl}
              size={34}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold text-slate-700">
                {person.fullName}
              </span>
              <span className="block text-[10px] text-slate-400">{person.subtitle}</span>
            </span>
            <Plus className="size-4 text-slate-300" />
          </button>
        ))}
        {people.length === 0 && (
          <p className="py-6 text-center text-[11px] text-slate-400">مخاطبی یافت نشد</p>
        )}
      </div>
      {role === "student" && !canStudentDm && (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[10px] leading-5 text-slate-500">
          دانش‌آموزان می‌توانند با دبیران و مدیر مدرسه گفت‌وگوی مستقیم داشته باشند.
        </p>
      )}
    </Modal>
  );
}
