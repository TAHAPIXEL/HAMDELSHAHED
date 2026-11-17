"use client";

import { useEffect, useRef, useState } from "react";
import {
  Search,
  Send,
  ImagePlus,
  Users,
  Megaphone,
  MessagesSquare,
  Plus,
  X,
  Check,
  CheckCheck,
  Info,
  Pencil,
  Trash2,
  ChevronRight,
  Lock,
  Unlock,
  UserRoundPlus,
  School,
  Crown,
  ShieldCheck,
  UserPlus,
  MoreHorizontal,
  Copy,
  BarChart3,
  Pin,
  PinOff,
} from "lucide-react";
import {
  DB,
  SECTIONS,
  canAdminPanel,
  canDm,
  canPostInChat,
  chatAvatarUser,
  chatMessages,
  chatOwnerId,
  chatTitle,
  className,
  fa,
  faDate,
  faTime,
  uploadImage,
  isChatAdmin,
  isChatOwner,
  hasChatPerm,
  ALL_CHAT_PERMS,
  FULL_CHAT_PERMS,
  type ChatAdminPerms,
  isStaff,
  isHighTrust,
  markSeen,
  openDirect,
  roleFa,
  sendMessage,
  sendPoll,
  togglePin,
  togglePollVote,
  unreadCount,
  userChats,
  uid,
  type Chat,
  type Grade,
  type Message,
  type Poll,
  type User,
} from "@/lib/model";
import { Avatar, Btn, Confirm, Empty, Field, Modal, inputCls, useDbTick, useToast } from "./ui";

const groupGrad = "bg-gradient-to-br from-emerald-500 to-teal-500";
const channelGrad = "bg-gradient-to-br from-amber-500 to-orange-500";

export default function Chats({
  user,
  externalChatId,
  onConsumeExternal,
}: {
  user: User;
  externalChatId: string | null;
  onConsumeExternal: () => void;
}) {
  useDbTick(); // هر تغییری در داده‌ها، بلافاصله رابط را زنده می‌کند
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDm, setShowDm] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const toast = useToast();

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const bulkDelete = () => {
    const ids = new Set(selected);
    DB.saveChats(DB.chats().filter((c) => !ids.has(c.id)));
    DB.saveMessages(DB.messages().filter((m) => !ids.has(m.chatId)));
    if (activeId && ids.has(activeId)) setActiveId(null);
    toast("success", `${fa(ids.size)} گفتگو حذف شد`);
    exitSelect();
  };

  // بدون memo — همیشه تازه‌ترین داده‌ها خوانده شود (رفع باگ نمایش پیام‌ها)
  const chats = userChats(user);
  const active = chats.find((c) => c.id === activeId) ?? DB.chats().find((c) => c.id === activeId) ?? null;

  // باز کردن گفتگو از بیرون (مثلاً از اطلاعیه): در حین رندر، بدون setState داخل effect
  const [consumedExt, setConsumedExt] = useState<string | null>(null);
  if (externalChatId && externalChatId !== consumedExt) {
    setConsumedExt(externalChatId);
    setActiveId(externalChatId);
  }
  useEffect(() => {
    if (externalChatId) onConsumeExternal();
  }, [externalChatId, onConsumeExternal]);

  const activeChatId = active?.id;
  const activeChatActivity = active?.lastActivity;
  useEffect(() => {
    if (activeChatId && activeChatActivity) markSeen(user.id, activeChatId, activeChatActivity);
  }, [activeChatId, activeChatActivity, user.id, chats.length]);

  const filtered = chats.filter((c) => chatTitle(c, user).includes(query.trim()));

  return (
    <div className="flex h-full">
      {/* لیست چت‌ها */}
      <div
        className={`flex w-full flex-col border-l border-slate-200/70 bg-white/60 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/40 sm:w-80 lg:w-[21rem] ${
          active ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="space-y-3 p-4 pb-3">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pr-10`}
              placeholder="جست‌وجوی گفتگو..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {selectMode ? (
            <div className="flex items-center gap-2">
              <Btn kind="ghost" className="!py-2 !text-[12px]" onClick={exitSelect}>
                انصراف
              </Btn>
              <Btn
                kind="danger"
                className="flex-1 !py-2 !text-[12px]"
                disabled={selected.size === 0}
                onClick={() => setConfirmBulk(true)}
              >
                <Trash2 className="size-4" />
                حذف {selected.size > 0 ? `(${fa(selected.size)})` : ""}
              </Btn>
            </div>
          ) : (
            <div className="flex gap-2">
              {isStaff(user) && (
                <Btn kind="soft" className="flex-1 !py-2 !text-[12px]" onClick={() => setShowCreate(true)}>
                  <Plus className="size-4" />
                  گروه / کانال
                </Btn>
              )}
              <Btn kind="soft" className="flex-1 !py-2 !text-[12px]" onClick={() => setShowDm(true)}>
                <UserRoundPlus className="size-4" />
                گفتگوی شخصی
              </Btn>
              {isStaff(user) && (
                <Btn
                  kind="ghost"
                  className="!px-3 !py-2"
                  onClick={() => setSelectMode(true)}
                >
                  <Trash2 className="size-4" />
                </Btn>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
          {filtered.length === 0 && (
            <Empty
              icon={<MessagesSquare className="size-7" />}
              title="گفتگویی نیست"
              desc={
                isStaff(user)
                  ? "از دکمه «گروه / کانال» یک گفتگوی جدید بسازید"
                  : "وقتی کادر مدرسه شما را عضو گروهی کند، اینجا نمایش داده می‌شود"
              }
            />
          )}
          <div className="space-y-1">
            {filtered.map((c) => {
              const unread = unreadCount(user.id, c);
              const last = chatMessages(c.id).filter((m) => !m.deleted).slice(-1)[0];
              const otherUser = chatAvatarUser(c, user);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (selectMode) {
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      });
                    } else {
                      setActiveId(c.id);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-right transition ${
                    selectMode && selected.has(c.id)
                      ? "bg-rose-50 ring-1 ring-rose-300 dark:bg-rose-500/10 dark:ring-rose-400/30"
                      : activeId === c.id && !selectMode
                      ? "bg-gradient-to-l from-indigo-600/10 to-violet-600/10 ring-1 ring-indigo-500/20"
                      : "hover:bg-slate-100/80 dark:hover:bg-white/5"
                  }`}
                >
                  {selectMode && (
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                        selected.has(c.id) ? "border-rose-500 bg-rose-500 text-white" : "border-slate-300 dark:border-white/20"
                      }`}
                    >
                      {selected.has(c.id) && <Check className="size-3" />}
                    </span>
                  )}
                  {c.type === "direct" ? (
                    <Avatar user={otherUser ?? null} size={44} />
                  ) : (
                    <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow ${c.type === "channel" ? channelGrad : groupGrad}`}>
                      {c.type === "channel" ? <Megaphone className="size-5" /> : <Users className="size-5" />}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-bold text-slate-800 dark:text-slate-100">
                        {chatTitle(c, user)}
                      </span>
                      {c.locked && c.type === "group" && <Lock className="size-3 shrink-0 text-amber-500" />}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-slate-400">
                      {last ? (last.deleted ? "پیام حذف شد" : last.image ? "تصویر پیوست شد" : last.text) : "هنوز پیامی نیست"}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {last && <span className="text-[10px] font-bold text-slate-400">{faTime(last.createdAt)}</span>}
                    {unread > 0 && (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-gradient-to-l from-indigo-600 to-violet-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                        {fa(unread)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* پنجره چت */}
      <div className={`min-w-0 flex-1 flex-col ${active ? "flex" : "hidden sm:flex"}`}>
        {active ? (
          <ChatWindow key={active.id} chat={active} user={user} onBack={() => setActiveId(null)} />
        ) : (
          <div className="chat-bg flex h-full items-center justify-center">
            <Empty
              icon={<MessagesSquare className="size-8" />}
              title="یک گفتگو را انتخاب کنید"
              desc="گروه، کانال یا گفتگوی شخصی را از لیست باز کنید"
            />
          </div>
        )}
      </div>

      {showCreate && (
        <CreateChatWizard user={user} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); setActiveId(id); }} />
      )}
      {showDm && (
        <NewDmModal user={user} onClose={() => setShowDm(false)} onOpen={(id) => { setShowDm(false); setActiveId(id); }} />
      )}

      <Confirm
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        onYes={bulkDelete}
        title="حذف گفتگوهای انتخاب‌شده"
        desc={`${fa(selected.size)} گفتگو و تمام پیام‌های آن‌ها برای همیشه حذف می‌شود. مطمئن هستید؟`}
        yesLabel="حذف"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// پنجره چت
// ----------------------------------------------------------------------------

function ChatWindow({ chat, user, onBack }: { chat: Chat; user: User; onBack: () => void }) {
  useDbTick(); // زنده‌سازی پیام‌ها
  const toast = useToast();
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [editing, setEditing] = useState<Message | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [delMsg, setDelMsg] = useState<Message | null>(null);
  const [menuMsg, setMenuMsg] = useState<Message | null>(null);
  const [showPoll, setShowPoll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stickRef = useRef(true);

  // بدون memo — هر رندر، تازه‌ترین پیام‌ها (رفع باگ ارسال و نمایش نشدن)
  const messages = chatMessages(chat.id);
  const canPost = canPostInChat(chat, user);
  const otherUser = chatAvatarUser(chat, user);
  const canLock = chat.type === "group" && hasChatPerm(chat, user, "lock");

  useEffect(() => {
    if (stickRef.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, chat.lastActivity]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat.id]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const submit = () => {
    if (!text.trim() && !image) return;
    if (editing) {
      const all = DB.messages();
      const idx = all.findIndex((m) => m.id === editing.id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], text: text.trim(), editedAt: Date.now() };
        DB.saveMessages(all);
      }
      setEditing(null);
      setText("");
      return;
    }
    sendMessage(chat.id, user, text, image);
    setText("");
    setImage(undefined);
    stickRef.current = true;
  };

  const doDelete = (m: Message) => {
    const all = DB.messages();
    const idx = all.findIndex((x) => x.id === m.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], deleted: true, text: "", image: undefined };
      DB.saveMessages(all);
    }
    toast("success", "پیام حذف شد");
  };

  const toggleLock = () => {
    const chats = DB.chats();
    const idx = chats.findIndex((c) => c.id === chat.id);
    if (idx >= 0) {
      chats[idx] = { ...chats[idx], locked: !chats[idx].locked };
      DB.saveChats(chats);
      toast("success", chats[idx].locked ? "فقط کادر می‌توانند پیام دهند" : "محدودیت پیام برداشته شد");
    }
  };

  const pickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setImage(await uploadImage(f, 960, 0.7));
    } catch (err) {
      toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
    }
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col">
      {/* هدر چت */}
      <div className="z-10 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-3 py-2.5 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/60 sm:px-4">
        <button onClick={onBack} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 sm:hidden" aria-label="بازگشت">
          <ChevronRight className="size-5" />
        </button>
        {chat.type === "direct" ? (
          <Avatar user={otherUser ?? null} size={40} />
        ) : (
          <div className={`flex size-10 items-center justify-center rounded-2xl text-white shadow ${chat.type === "channel" ? channelGrad : groupGrad}`}>
            {chat.type === "channel" ? <Megaphone className="size-4.5" /> : <Users className="size-4.5" />}
          </div>
        )}
        <button className="min-w-0 flex-1 text-right" onClick={() => setShowInfo(true)}>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{chatTitle(chat, user)}</span>
            {chat.locked && chat.type === "group" && <Lock className="size-3.5 shrink-0 text-amber-500" />}
          </div>
          <div className="text-[11px] font-semibold text-slate-400">
            {chat.type === "direct"
              ? otherUser
                ? `${roleFa(otherUser)}${otherUser.grade ? ` • کلاس ${className(otherUser.grade, otherUser.section!)}` : ""}`
                : "گفتگوی شخصی"
              : chat.type === "channel"
              ? "کانال • فقط مدیران پیام می‌دهند"
              : `${fa(chat.memberIds.length)} عضو`}
          </div>
        </button>
        {canLock && (
          <button
            onClick={toggleLock}
            className={`rounded-xl p-2.5 transition ${chat.locked ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10" : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"}`}
            title={chat.locked ? "برداشتن محدودیت پیام" : "فقط کادر پیام دهند"}
          >
            {chat.locked ? <Lock className="size-5" /> : <Unlock className="size-5" />}
          </button>
        )}
        <button onClick={() => setShowInfo(true)} className="rounded-xl p-2.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/10" aria-label="اطلاعات">
          <Info className="size-5" />
        </button>
      </div>

      {/* نوار پیام سنجاق‌شده */}
      {(() => {
        if (!chat.pinnedId) return null;
        const pm = messages.find((m) => m.id === chat.pinnedId && !m.deleted);
        if (!pm) return null;
        return (
          <div className="flex items-center gap-2.5 border-b border-amber-200/60 bg-amber-50/90 px-4 py-2.5 backdrop-blur dark:border-amber-400/20 dark:bg-amber-500/10">
            <Pin className="size-4 shrink-0 -scale-y-100 text-amber-500" />
            <div className="min-w-0 flex-1">
              <div className="text-[10.5px] font-black text-amber-600 dark:text-amber-300">پیام سنجاق‌شده</div>
              <div className="truncate text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
                {pm.poll ? `نظرسنجی: ${pm.poll.question}` : pm.image ? "تصویر" : pm.text}
              </div>
            </div>
            {/* برداشتن سنجاق — فقط فرستنده همان پیام */}
            {chat.type !== "direct" && hasChatPerm(chat, user, "pin") && pm.senderId === user.id && (
              <button
                onClick={() => { togglePin(chat.id, null); toast("success", "سنجاق برداشته شد"); }}
                className="rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-100 dark:hover:bg-amber-500/20"
                aria-label="برداشتن سنجاق"
              >
                <PinOff className="size-4" />
              </button>
            )}
          </div>
        );
      })()}

      {/* پیام‌ها */}
      <div ref={listRef} onScroll={onScroll} className="chat-bg min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-6">
        {messages.length === 0 && (
          <Empty icon={<MessagesSquare className="size-7" />} title="گفتگو را شروع کنید" desc="اولین پیام را ارسال کنید" />
        )}
        {messages.map((m, idx) => {
          const day = faDate(m.createdAt);
          const showDay = idx === 0 || faDate(messages[idx - 1].createdAt) !== day;
          const mine = m.senderId === user.id;
          const sender = m.senderId === "dev-root" ? undefined : DB.users().find((u) => u.id === m.senderId);
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-slate-200/70 px-4 py-1 text-[11px] font-bold text-slate-500 backdrop-blur dark:bg-white/10 dark:text-slate-300">
                    {day}
                  </span>
                </div>
              )}
              <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} msg-in`}>
                {!mine && chat.type !== "direct" && <Avatar user={sender ?? null} size={28} className="mb-1" />}
                <div
                  role={!m.deleted && mine ? "button" : undefined}
                  tabIndex={!m.deleted && mine ? 0 : undefined}
                  onClick={() => {
                    if (!m.deleted && mine) setMenuMsg(m);
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !m.deleted && mine) {
                      e.preventDefault();
                      setMenuMsg(m);
                    }
                  }}
                  className={`relative max-w-[78%] px-3.5 py-2.5 shadow-sm transition sm:max-w-[65%] ${
                    !m.deleted && mine ? "cursor-pointer active:scale-[0.99]" : ""
                  } ${
                    mine
                      ? "bubble-mine bg-gradient-to-bl from-indigo-600 to-violet-600 text-white"
                      : "bubble-other bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  {!mine && chat.type !== "direct" && (
                    <div className="mb-1 text-[11px] font-black text-indigo-500 dark:text-indigo-300">
                      {sender ? `${sender.firstName} ${sender.lastName}` : "مدیریت مدرسه"}
                      {sender && isStaff(sender) && <span className="mr-1.5 font-semibold text-amber-500">({roleFa(sender)})</span>}
                    </div>
                  )}
                  {m.deleted ? (
                    <div className={`text-[13px] italic ${mine ? "text-white/60" : "text-slate-400"}`}>این پیام حذف شد</div>
                  ) : m.poll ? (
                    <PollBubble poll={m.poll} messageId={m.id} me={user} mine={mine} />
                  ) : (
                    <>
                      {m.image && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewer(m.image!); }}
                          className="mb-1.5 block overflow-hidden rounded-xl"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.image} alt="تصویر پیام" className="max-h-64 w-full rounded-xl object-cover transition hover:opacity-90" />
                        </button>
                      )}
                      {m.text && <div className="user-text whitespace-pre-wrap break-words text-[14px] leading-7">{m.text}</div>}
                    </>
                  )}
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold ${mine ? "text-white/70" : "text-slate-400"}`}>
                    {m.editedAt && !m.deleted && <span>ویرایش‌شده</span>}
                    <span>{faTime(m.createdAt)}</span>
                    {mine && <CheckCheck className="size-3.5" />}
                  </div>

                  {/* نشانه‌ی وجود منوی گزینه‌ها (با کلیک یا ضربه روی پیام باز می‌شود) */}
                  {!m.deleted && mine && (
                    <span
                      className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 rounded-full p-1.5 opacity-0 transition group-hover:opacity-100 sm:block ${
                        mine ? "-left-1 -translate-x-full bg-white/80 text-slate-400 dark:bg-slate-800/80" : "-right-1 translate-x-full bg-white/80 text-slate-400 dark:bg-slate-800/80"
                      }`}
                    >
                      <MoreHorizontal className="size-3.5" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* نوار ارسال */}
      <div className="border-t border-slate-200/70 bg-white/85 px-3 py-3 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/70 sm:px-5">
        {canPost ? (
          <>
            {editing && (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-indigo-50 px-3.5 py-2 text-[12px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <span className="flex items-center gap-2"><Pencil className="size-3.5" /> در حال ویرایش پیام</span>
                <button onClick={() => { setEditing(null); setText(""); }} aria-label="لغو ویرایش"><X className="size-4" /></button>
              </div>
            )}
            {image && (
              <div className="relative mb-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="پیش‌نمایش" className="h-20 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-white/10" />
                <button onClick={() => setImage(undefined)} className="absolute -left-2 -top-2 rounded-full bg-rose-500 p-1 text-white shadow" aria-label="حذف تصویر">
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              {isStaff(user) && chat.type !== "direct" && (
                <button
                  onClick={() => setShowPoll(true)}
                  className="rounded-2xl p-3 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/10"
                  aria-label="ایجاد نظرسنجی"
                  title="ایجاد نظرسنجی"
                >
                  <BarChart3 className="size-5" />
                </button>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-2xl p-3 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/10"
                aria-label="ارسال تصویر"
              >
                <ImagePlus className="size-5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              <textarea
                rows={1}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="پیام خود را بنویسید..."
                className="max-h-[140px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/5 dark:focus:border-indigo-400/50"
              />
              <button
                onClick={submit}
                disabled={!text.trim() && !image}
                className="rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 p-3 text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:shadow-none"
                aria-label="ارسال"
              >
                <Send className="size-5 -scale-x-100" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-[13px] font-bold text-slate-400">
            <Lock className="size-4" />
            {chat.type === "channel"
              ? "در کانال‌ها فقط مدیران کانال می‌توانند پیام ارسال کنند"
              : "ارسال پیام در این گروه فقط برای کادر مدرسه باز است"}
          </div>
        )}
      </div>

      {/* مودال اطلاعات و مدیریت اعضا */}
      <ChatInfoModal
        chatId={chat.id}
        user={user}
        open={showInfo}
        onClose={() => setShowInfo(false)}
        onDeleted={() => { setShowInfo(false); onBack(); }}
      />

      {/* نمایش تصویر بزرگ */}
      {viewer && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm" onClick={() => setViewer(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="تصویر" className="max-h-[88vh] max-w-full rounded-2xl shadow-2xl" />
          <button className="absolute left-4 top-4 rounded-full bg-white/10 p-2.5 text-white backdrop-blur hover:bg-white/20" aria-label="بستن">
            <X className="size-5" />
          </button>
        </div>
      )}

      {/* منوی گزینه‌های پیام — با کلیک یا ضربه روی پیام */}
      <Modal
        open={!!menuMsg}
        onClose={() => setMenuMsg(null)}
        title="گزینه‌های پیام"
        icon={<MoreHorizontal className="size-5 text-indigo-500" />}
      >
        {menuMsg && (
          <div className="space-y-3">
            <div className="max-h-28 overflow-y-auto rounded-2xl bg-slate-50 px-4 py-3 text-[13px] leading-7 text-slate-600 dark:bg-white/5 dark:text-slate-300">
              {menuMsg.image && !menuMsg.text ? "تصویر پیوست‌شده" : menuMsg.text}
            </div>
            <div className="space-y-2">
              {/* سنجاق — فقط کادر و فقط روی پیام خودش */}
              {chat.type !== "direct" && hasChatPerm(chat, user, "pin") && menuMsg.senderId === user.id && (
                <button
                  onClick={() => {
                    const pinned = chat.pinnedId === menuMsg.id;
                    togglePin(chat.id, pinned ? null : menuMsg.id);
                    toast("success", pinned ? "سنجاق برداشته شد" : "پیام بالای گفتگو سنجاق شد");
                    setMenuMsg(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-right text-[13.5px] font-black text-slate-700 transition hover:bg-amber-50 hover:text-amber-700 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-amber-500/10"
                >
                  <Pin className="size-4.5 -scale-y-100 text-amber-500" />
                  {chat.pinnedId === menuMsg.id ? "برداشتن سنجاق" : "سنجاق کردن پیام"}
                </button>
              )}
              {menuMsg.senderId === user.id && !menuMsg.image && !menuMsg.poll && (
                <button
                  onClick={() => { setEditing(menuMsg); setText(menuMsg.text); setMenuMsg(null); }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-right text-[13.5px] font-black text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-indigo-500/10"
                >
                  <Pencil className="size-4.5 text-indigo-500" />
                  ویرایش پیام
                </button>
              )}
              {menuMsg.text && (
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(menuMsg.text).then(
                      () => toast("success", "متن پیام کپی شد"),
                      () => toast("error", "کپی ممکن نشد")
                    );
                    setMenuMsg(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-right text-[13.5px] font-black text-slate-700 transition hover:bg-slate-100 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  <Copy className="size-4.5 text-slate-400" />
                  کپی متن پیام
                </button>
              )}
              {/* حذف — فقط پیام خود کاربر */}
              {menuMsg.senderId === user.id && (
                <button
                  onClick={() => { setDelMsg(menuMsg); setMenuMsg(null); }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3.5 text-right text-[13.5px] font-black text-rose-600 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                >
                  <Trash2 className="size-4.5" />
                  حذف پیام
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {showPoll && <PollCreateModal chatId={chat.id} user={user} onClose={() => setShowPoll(false)} />}

      <Confirm
        open={!!delMsg}
        onClose={() => setDelMsg(null)}
        onYes={() => delMsg && doDelete(delMsg)}
        title="حذف پیام"
        desc="این پیام برای همه اعضا حذف می‌شود. مطمئن هستید؟"
        yesLabel="حذف"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// حباب نظرسنجی
// ----------------------------------------------------------------------------

function PollBubble({
  poll,
  messageId,
  me,
  mine,
}: {
  poll: Poll;
  messageId: string;
  me: User;
  mine: boolean;
}) {
  const total = Object.keys(poll.votes).length;
  const myVote = poll.votes[me.id];
  return (
    <div className="min-w-56 sm:min-w-64">
      <div className={`mb-2 flex items-center gap-2 text-[11px] font-black ${mine ? "text-white/90" : "text-indigo-500 dark:text-indigo-300"}`}>
        <BarChart3 className="size-4" />
        نظرسنجی
      </div>
      <div className={`mb-3 text-[14px] font-black leading-7 ${mine ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>
        {poll.question}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = Object.values(poll.votes).filter((v) => v === i).length;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const chosen = myVote === i;
          return (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); togglePollVote(messageId, i, me.id); }}
              className={`relative block w-full overflow-hidden rounded-xl px-3 py-2.5 text-right transition active:scale-[0.99] ${
                chosen
                  ? mine
                    ? "bg-white/25 ring-1 ring-white/50"
                    : "bg-indigo-100 ring-1 ring-indigo-400 dark:bg-indigo-500/20 dark:ring-indigo-400/60"
                  : mine
                  ? "bg-white/10 hover:bg-white/20"
                  : "bg-slate-100 hover:bg-slate-200/80 dark:bg-white/5 dark:hover:bg-white/10"
              }`}
            >
              <span
                className={`absolute inset-y-0 right-0 transition-all duration-500 ${
                  chosen ? (mine ? "bg-white/15" : "bg-indigo-200/50 dark:bg-indigo-400/20") : mine ? "bg-white/5" : "bg-slate-200/40 dark:bg-white/5"
                }`}
                style={{ width: total > 0 ? `${pct}%` : "0%" }}
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className={`flex items-center gap-1.5 text-[13px] font-bold ${mine ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>
                  {chosen && <Check className="size-3.5" />}
                  {opt}
                </span>
                {total > 0 && (
                  <span className={`text-[10.5px] font-black tabular-nums ${mine ? "text-white/80" : "text-slate-400"}`}>
                    {fa(pct)}٪
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className={`mt-2 text-[10.5px] font-bold ${mine ? "text-white/70" : "text-slate-400"}`}>
        {fa(total)} رأی{myVote !== undefined ? " • برای لغو رأی، دوباره روی همان گزینه بزنید" : ""}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// ساخت نظرسنجی (کادر)
// ----------------------------------------------------------------------------

function PollCreateModal({ chatId, user, onClose }: { chatId: string; user: User; onClose: () => void }) {
  const toast = useToast();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const create = () => {
    if (!question.trim()) return toast("error", "سؤال نظرسنجی را بنویسید");
    const opts = options.filter((o) => o.trim() !== "");
    if (opts.length < 2) return toast("error", "حداقل دو گزینه لازم است");
    sendPoll(chatId, user, question, opts);
    toast("success", "نظرسنجی ارسال شد");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="ایجاد نظرسنجی" icon={<BarChart3 className="size-5 text-indigo-500" />}>
      <div className="space-y-4">
        <Field label="سؤال نظرسنجی" required>
          <input className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="مثلاً کلاس فوق‌العاده چه روزی باشد؟" />
        </Field>
        <Field label="گزینه‌ها" required>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-500 dark:bg-white/10">
                  {fa(i + 1)}
                </span>
                <input
                  className={inputCls}
                  value={o}
                  onChange={(e) => setOptions((os) => os.map((x, xi) => (xi === i ? e.target.value : x)))}
                  placeholder={`گزینه ${fa(i + 1)}`}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => setOptions((os) => os.filter((_, xi) => xi !== i))}
                    className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                    aria-label="حذف گزینه"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Field>
        {options.length < 6 && (
          <Btn kind="soft" className="!py-2 !text-[12px]" onClick={() => setOptions((os) => [...os, ""])}>
            <Plus className="size-3.5" />
            افزودن گزینه
          </Btn>
        )}
        <Btn className="w-full" onClick={create}>
          <Send className="size-4" />
          ارسال نظرسنجی
        </Btn>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// مودال اطلاعات چت + مدیریت مالک/مدیران/اعضا
// ----------------------------------------------------------------------------

function ChatInfoModal({
  chatId,
  user,
  open,
  onClose,
  onDeleted,
}: {
  chatId: string;
  user: User;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  useDbTick();
  const toast = useToast();
  const chat = DB.chats().find((c) => c.id === chatId);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [permsFor, setPermsFor] = useState<User | null>(null);

  if (!chat) return null;

  // حذف کامل گفتگو — فقط کادر مدرسه (برای گروه، کانال و گفتگوی شخصی)
  const deleteChat = () => {
    DB.saveChats(DB.chats().filter((c) => c.id !== chat.id));
    DB.saveMessages(DB.messages().filter((m) => m.chatId !== chat.id));
    toast("success", "گفتگو و همه پیام‌هایش حذف شد");
    onDeleted();
  };

  const ownerId = chatOwnerId(chat);
  const adminIds = chat.admins ?? [];
  const isOwner = user.role === "developer" || ownerId === user.id;
  const canMembers = hasChatPerm(chat, user, "members") || isHighTrust(user);
  const canRemoveChat = hasChatPerm(chat, user, "remove") || isHighTrust(user);
  const users = DB.users();
  const memberUsers = chat.memberIds.map((id) => users.find((u) => u.id === id)).filter(Boolean) as User[];

  const update = (patch: Partial<Chat>) => {
    const chats = DB.chats();
    const idx = chats.findIndex((c) => c.id === chat.id);
    if (idx >= 0) {
      chats[idx] = { ...chats[idx], ...patch };
      DB.saveChats(chats);
    }
  };

  const toggleAdmin = (uid_: string) => {
    const admins = new Set(adminIds);
    const perms = { ...(chat.adminPerms ?? {}) };
    if (admins.has(uid_)) {
      admins.delete(uid_);
      delete perms[uid_];
    } else {
      admins.add(uid_);
      perms[uid_] = { ...FULL_CHAT_PERMS, post: chat.type === "channel" };
    }
    update({ admins: [...admins], adminPerms: perms });
    toast("success", admins.has(uid_) ? "به مدیران اضافه شد — اختیاراتش را می‌توانید تنظیم کنید" : "از مدیران حذف شد");
  };

  const setPerm = (uid_: string, key: keyof ChatAdminPerms, val: boolean) => {
    const perms = { ...(chat.adminPerms ?? {}) };
    perms[uid_] = { ...(perms[uid_] ?? {}), [key]: val };
    update({ adminPerms: perms });
  };

  const removeMember = (uid_: string) => {
    update({ memberIds: chat.memberIds.filter((id) => id !== uid_), admins: adminIds.filter((id) => id !== uid_) });
    toast("success", "عضو حذف شد");
  };

  const roleBadge = (u: User) => {
    if (u.id === ownerId || u.role === "developer")
      return <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Crown className="size-3" />مالک</span>;
    if (adminIds.includes(u.id))
      return <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><ShieldCheck className="size-3" />مدیر</span>;
    return null;
  };

  return (
    <Modal open={open} onClose={onClose} title={chat.type === "direct" ? "اطلاعات گفتگو" : "اطلاعات و اعضا"} icon={<Info className="size-5 text-indigo-500" />}>
      <div className="mb-5 flex items-center gap-3">
        <div className={`flex size-12 items-center justify-center rounded-2xl text-white ${chat.type === "channel" ? channelGrad : chat.type === "direct" ? "bg-gradient-to-br from-slate-500 to-slate-600" : groupGrad}`}>
          {chat.type === "channel" ? <Megaphone className="size-5" /> : chat.type === "direct" ? <UserRoundPlus className="size-5" /> : <Users className="size-5" />}
        </div>
        <div>
          <div className="text-sm font-black text-slate-800 dark:text-slate-100">{chatTitle(chat, user)}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400">
            {chat.type === "channel" ? "کانال — فقط مدیران پیام می‌دهند" : chat.type === "direct" ? "گفتگوی شخصی" : "گروه"}
            {chat.locked && chat.type === "group" && <span className="text-amber-500">• قفل: فقط کادر</span>}
          </div>
          {chat.description && <div className="mt-1 text-[12px] leading-5 text-slate-400">{chat.description}</div>}
        </div>
      </div>

      {chat.type !== "direct" && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-black text-slate-400">اعضا — {fa(memberUsers.length)} نفر</div>
            {canMembers && (
              <Btn kind="soft" className="!py-1.5 !text-[11.5px]" onClick={() => setAddOpen(true)}>
                <UserPlus className="size-3.5" />
                افزودن عضو
              </Btn>
            )}
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {memberUsers.length === 0 && (
              <div className="py-6 text-center text-[12px] font-semibold text-slate-400">هنوز عضوی اضافه نشده است</div>
            )}
            {memberUsers.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/5">
                <Avatar user={m} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{m.firstName} {m.lastName}</span>
                    {roleBadge(m)}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {roleFa(m)}{m.grade ? ` • ${className(m.grade, m.section!)}` : ""}
                  </div>
                </div>
                {/* تعیین مدیر و اختیارات — فقط مالک و فقط برای کادر */}
                {isOwner && m.id !== user.id && m.role !== "student" && m.id !== ownerId && (
                  <>
                    {adminIds.includes(m.id) && (
                      <button
                        onClick={() => setPermsFor(m)}
                        className="rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[10.5px] font-black text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        اختیارات
                      </button>
                    )}
                    <button
                      onClick={() => toggleAdmin(m.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-[10.5px] font-black transition ${
                        adminIds.includes(m.id)
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                      }`}
                    >
                      {adminIds.includes(m.id) ? "حذف از مدیران" : "مدیر شود"}
                    </button>
                  </>
                )}
                {/* حذف عضو — مالک و مدیران (به جز مالک) */}
                {canMembers && m.id !== ownerId && m.id !== user.id && (
                  <button onClick={() => removeMember(m.id)} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10" aria-label="حذف عضو">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* حذف گفتگو — در دسترس همه اعضای کادر مدرسه، برای هر نوع گفتگو */}
      {canRemoveChat && (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
          <Btn kind="danger" className="w-full" onClick={() => setConfirmDel(true)}>
            <Trash2 className="size-4" />
            حذف کامل {chat.type === "channel" ? "کانال" : chat.type === "direct" ? "گفتگوی شخصی" : "گروه"}
          </Btn>
          <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
            گفتگو و همه پیام‌های آن برای همه اعضا حذف می‌شود
          </p>
        </div>
      )}

      {/* تعیین اختیارات مدیر */}
      <Modal
        open={!!permsFor}
        onClose={() => setPermsFor(null)}
        title={permsFor ? `اختیارات ${permsFor.firstName} ${permsFor.lastName}` : ""}
        icon={<ShieldCheck className="size-5 text-violet-500" />}
      >
        {permsFor && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/5">
              <Avatar user={permsFor} size={40} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">{permsFor.firstName} {permsFor.lastName}</div>
                <div className="text-[11px] font-semibold text-slate-400">{roleFa(permsFor)} • مدیر این {chat.type === "channel" ? "کانال" : "گروه"}</div>
              </div>
            </div>
            <div className="space-y-2">
              {ALL_CHAT_PERMS.filter((p) => (p.key === "post" ? chat.type === "channel" : p.key === "lock" ? chat.type === "group" : true)).map((p) => {
                const on = !!chat.adminPerms?.[permsFor.id]?.[p.key];
                return (
                  <button
                    key={p.key}
                    onClick={() => setPerm(permsFor.id, p.key, !on)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-right transition ${
                      on ? "border-violet-400 bg-violet-50/70 dark:border-violet-400/40 dark:bg-violet-500/10" : "border-slate-200 dark:border-white/10"
                    }`}
                  >
                    <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-violet-600" : "bg-slate-300 dark:bg-white/15"}`}>
                      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-black text-slate-700 dark:text-slate-200">{p.label}</span>
                      <span className="block text-[11px] text-slate-400">{p.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] font-semibold leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-400">
              تغییرات بلافاصله ذخیره می‌شود. شما به‌عنوان مالک همیشه همه اختیارات را دارید.
            </p>
            <Btn className="w-full" onClick={() => setPermsFor(null)}>تأیید</Btn>
          </div>
        )}
      </Modal>

      {addOpen && <AddMembersModal chat={chat} onClose={() => setAddOpen(false)} />}

      <Confirm
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onYes={deleteChat}
        title="حذف گفتگو"
        desc={`«${chatTitle(chat, user)}» و تمام پیام‌های آن برای همیشه حذف می‌شود. مطمئن هستید؟`}
        yesLabel="حذف کامل"
      />
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// انتخاب دانش‌آموز (با فیلتر اختیاری کلاس) — مشترک بین ویزارد و افزودن عضو
// ----------------------------------------------------------------------------

function StudentPicker({
  picked,
  onToggle,
  onToggleAll,
}: {
  picked: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], all: boolean) => void;
}) {
  const [grade, setGrade] = useState<Grade>(7);
  const [section, setSection] = useState("1");
  const [q, setQ] = useState("");

  const all = DB.users().filter((u) => u.role === "student");
  const filtered = all.filter(
    (u) =>
      (!q.trim() && u.grade === grade && u.section === section) ||
      (q.trim() !== "" && `${u.firstName} ${u.lastName}`.includes(q.trim()))
  );
  const allInFilterPicked = filtered.length > 0 && filtered.every((s) => picked.has(s.id));

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} !py-2 pr-9 !text-[12px]`}
            placeholder="جست‌وجوی نام دانش‌آموز..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {!q.trim() && (
          <>
            <select className={`${inputCls} !w-auto !py-2 !text-[12px]`} value={grade} onChange={(e) => { setGrade(Number(e.target.value) as Grade); setSection("1"); }}>
              {([7, 8, 9] as Grade[]).map((g) => (
                <option key={g} value={g}>پایه {className(g, "1").split(" ")[0]}</option>
              ))}
            </select>
            <select className={`${inputCls} !w-auto !py-2 !text-[12px]`} value={section} onChange={(e) => setSection(e.target.value)}>
              {SECTIONS[grade].map((s) => (
                <option key={s} value={s}>شعبه {s}</option>
              ))}
            </select>
          </>
        )}
        <Btn kind="soft" className="!py-2 !text-[11.5px]" onClick={() => onToggleAll(filtered.map((s) => s.id), allInFilterPicked)}>
          {allInFilterPicked ? "لغو انتخاب" : "انتخاب همه"}
        </Btn>
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-100 p-2 dark:border-white/5">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[12.5px] font-semibold text-slate-400">دانش‌آموزی یافت نشد</div>
        )}
        {filtered.map((s) => {
          const on = picked.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                on ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-400/30" : "hover:bg-slate-50 dark:hover:bg-white/5"
              }`}
            >
              <Avatar user={s} size={34} />
              <div className="min-w-0 flex-1 text-right">
                <div className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{s.firstName} {s.lastName}</div>
                <div className="text-[11px] text-slate-400">{s.grade ? className(s.grade, s.section!) : ""}</div>
              </div>
              <span className={`flex size-5.5 items-center justify-center rounded-full border-2 transition ${on ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300 dark:border-white/20"}`}>
                {on && <Check className="size-3.5" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddMembersModal({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const toast = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const existing = new Set(chat.memberIds);
  const students = DB.users().filter((u) => u.role === "student" && !existing.has(u.id));

  const add = () => {
    if (picked.size === 0) return toast("error", "حداقل یک دانش‌آموز را انتخاب کنید");
    const chats = DB.chats();
    const idx = chats.findIndex((c) => c.id === chat.id);
    if (idx >= 0) {
      chats[idx] = { ...chats[idx], memberIds: [...chats[idx].memberIds, ...picked] };
      DB.saveChats(chats);
    }
    toast("success", `${fa(picked.size)} عضو اضافه شد`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="افزودن عضو" icon={<UserPlus className="size-5 text-indigo-500" />}>
      {students.length === 0 ? (
        <Empty icon={<UserPlus className="size-7" />} title="دانش‌آموزی برای افزودن نیست" desc="همه دانش‌آموزان عضو هستند یا هنوز ثبت‌نام نکرده‌اند" />
      ) : (
        <div className="space-y-4">
          <StudentPicker
            picked={picked}
            onToggle={(id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            onToggleAll={(ids, all) =>
              setPicked((p) => {
                const n = new Set(p);
                ids.forEach((id) => { if (!existing.has(id)) { if (all) n.delete(id); else n.add(id); } });
                return n;
              })
            }
          />
          <Btn className="w-full" onClick={add}>افزودن {fa(picked.size)} عضو</Btn>
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// ویزارد ساخت گروه / کانال (فقط کادر) — بدون نیاز به تعیین کلاس
// ----------------------------------------------------------------------------

function CreateChatWizard({
  user,
  onClose,
  onCreated,
}: {
  user: User;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<"group" | "channel">("group");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [staffPicked, setStaffPicked] = useState<Set<string>>(new Set());

  const staffList = DB.users().filter((u) => u.role !== "student" && u.id !== user.id);
  const kind = type === "group" ? "گروه" : "کانال";

  const next = () => {
    if (step === 1) {
      if (!title.trim()) return toast("error", `نام ${kind} را وارد کنید`);
      setStep(2);
      return;
    }
    if (step === 2) { setStep(3); return; }
    if (step === 3) { setStep(4); return; }
    create();
  };

  const create = () => {
    const chats = DB.chats();
    const chat: Chat = {
      id: uid(type === "group" ? "g" : "ch"),
      type,
      title: title.trim(),
      description: desc.trim() || undefined,
      memberIds: [...picked, ...staffPicked, user.id],
      createdBy: user.id,
      ownerId: user.id,
      admins: [],
      adminPerms: {},
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
    chats.push(chat);
    DB.saveChats(chats);
    toast("success", `${kind} ساخته شد — شما مالک آن هستید`);
    onCreated(chat.id);
  };

  const steps = ["اطلاعات", "دانش‌آموزان", "کادر مدرسه", "تأیید"];

  return (
    <Modal open onClose={onClose} title={`ساخت ${kind} جدید`} icon={<Plus className="size-5 text-indigo-500" />}>
      {/* نوار مراحل */}
      <div className="mb-5 flex items-center gap-1.5">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <span className={`flex size-7 items-center justify-center rounded-full text-[11px] font-black transition ${
                step > i + 1 ? "bg-emerald-500 text-white" : step === i + 1 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-white/10"
              }`}>
                {step > i + 1 ? <Check className="size-3.5" /> : fa(i + 1)}
              </span>
              <span className={`whitespace-nowrap text-[9.5px] font-bold ${step === i + 1 ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && <span className={`mb-4 h-0.5 flex-1 rounded-full transition ${step > i + 1 ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/10"}`} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: "group", label: "گروه", hint: "همه اعضا پیام می‌دهند", icon: <Users className="size-5" /> },
              { v: "channel", label: "کانال", hint: "فقط مالک و مدیران پیام می‌دهند", icon: <Megaphone className="size-5" /> },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => setType(o.v)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-4 transition ${
                  type === o.v ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-500/15 dark:border-indigo-400/50 dark:bg-indigo-500/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10"
                }`}
              >
                <span className={type === o.v ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400"}>{o.icon}</span>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{o.label}</span>
                <span className="text-center text-[11px] text-slate-400">{o.hint}</span>
              </button>
            ))}
          </div>
          <Field label={`نام ${kind}`} required>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً ریاضی هفتم" />
          </Field>
          <Field label="توضیح کوتاه (اختیاری)">
            <input className={inputCls} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Btn className="w-full" onClick={next}>مرحله بعد: افزودن دانش‌آموزان</Btn>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <StudentPicker
            picked={picked}
            onToggle={(id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            onToggleAll={(ids, all) => setPicked((p) => { const n = new Set(p); ids.forEach((id) => (all ? n.delete(id) : n.add(id))); return n; })}
          />
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => setStep(1)}>بازگشت</Btn>
            <Btn className="flex-1" onClick={next}>مرحله بعد: افزودن کادر ({fa(picked.size)} دانش‌آموز)</Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-bold text-slate-600 dark:text-slate-300">
              اعضای کادر مدرسه — {fa(staffList.length)} نفر
            </div>
            <Btn
              kind="soft"
              className="!py-1.5 !text-[11.5px]"
              onClick={() => setStaffPicked((p) => (p.size === staffList.length ? new Set() : new Set(staffList.map((u) => u.id))))}
            >
              {staffPicked.size === staffList.length && staffList.length > 0 ? "لغو انتخاب همه" : "انتخاب همه"}
            </Btn>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-2xl border border-slate-100 p-2 dark:border-white/5">
            {staffList.length === 0 && (
              <div className="py-8 text-center text-[12.5px] font-semibold text-slate-400">عضو دیگری در کادر مدرسه ثبت نشده است</div>
            )}
            {staffList.map((u) => {
              const on = staffPicked.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => setStaffPicked((p) => { const n = new Set(p); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                    on ? "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:ring-violet-400/30" : "hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                >
                  <Avatar user={u} size={34} />
                  <div className="min-w-0 flex-1 text-right">
                    <div className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{u.firstName} {u.lastName}</div>
                    <div className="text-[11px] text-slate-400">{roleFa(u)}</div>
                  </div>
                  <span className={`flex size-5.5 items-center justify-center rounded-full border-2 transition ${on ? "border-violet-500 bg-violet-500 text-white" : "border-slate-300 dark:border-white/20"}`}>
                    {on && <Check className="size-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[11.5px] font-semibold leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-400">
            پس از ساخت، می‌توانید از بخش «اعضا» هر یک از کادر را مدیر کنید و اختیاراتش را تعیین کنید.
          </p>
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => setStep(2)}>بازگشت</Btn>
            <Btn className="flex-1" onClick={next}>مرحله بعد: تأیید نهایی</Btn>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3.5 dark:bg-white/5">
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-white ${type === "channel" ? channelGrad : groupGrad}`}>
              {type === "channel" ? <Megaphone className="size-5" /> : <Users className="size-5" />}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{title}</div>
              <div className="text-[11.5px] font-semibold text-slate-400">{kind}{desc ? ` • ${desc}` : ""}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { n: picked.size, l: "دانش‌آموز" },
              { n: staffPicked.size, l: "عضو کادر" },
              { n: picked.size + staffPicked.size + 1, l: "مجموع اعضا" },
            ].map((x) => (
              <div key={x.l} className="rounded-2xl bg-slate-50 py-3 dark:bg-white/5">
                <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fa(x.n)}</div>
                <div className="text-[10.5px] font-bold text-slate-400">{x.l}</div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-[12px] font-bold leading-6 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            شما به‌عنوان مالک این {kind} ثبت می‌شوید و همه اختیارات آن را خواهید داشت.
          </div>
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => setStep(3)}>بازگشت</Btn>
            <Btn className="flex-1" onClick={create}>
              <Check className="size-4" />
              تأیید و ساخت {kind}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// شروع گفتگوی شخصی
// ----------------------------------------------------------------------------

function NewDmModal({ user, onClose, onOpen }: { user: User; onClose: () => void; onOpen: (id: string) => void }) {
  useDbTick();
  const toast = useToast();
  const [q, setQ] = useState("");
  const all = DB.users().filter((u) => u.id !== user.id);
  const allowed = all.filter((u) => canDm(user, u));
  const filtered = allowed.filter((u) => `${u.firstName} ${u.lastName}`.includes(q.trim()));

  const startFor = (other: User) => {
    if (!canDm(user, other)) return toast("error", "اجازه گفتگوی شخصی با این کاربر را ندارید");
    const chat = openDirect(user, other);
    onOpen(chat.id);
  };

  return (
    <Modal open onClose={onClose} title="شروع گفتگوی شخصی" icon={<UserRoundPlus className="size-5 text-indigo-500" />}>
      <div className="relative mb-4">
        <Search className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input className={`${inputCls} pr-10`} placeholder="جست‌وجوی نام..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {user.role === "student" && (
        <p className="mb-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12px] font-semibold leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-400">
          شما می‌توانید با کادر مدرسه گفتگو کنید. گفتگو با دانش‌آموزان دیگر فقط با مجوز مدیریت ممکن است.
        </p>
      )}
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {filtered.length === 0 && (
          <Empty icon={<School className="size-7" />} title="کسی یافت نشد" desc="نام دیگری را جست‌وجو کنید" />
        )}
        {filtered.map((u) => (
          <button
            key={u.id}
            onClick={() => startFor(u)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <Avatar user={u} size={38} />
            <div className="min-w-0 flex-1 text-right">
              <div className="truncate text-[13.5px] font-bold text-slate-700 dark:text-slate-200">{u.firstName} {u.lastName}</div>
              <div className="text-[11px] font-semibold text-slate-400">
                {roleFa(u)}
                {u.grade ? ` • کلاس ${className(u.grade, u.section!)}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
