// ----------------------------------------------------------------------------
//  ذخیره‌ی پیش‌نویس‌ها (بدون React) — مجموعه‌ی drafts در همگام‌سازی کلاینت
//  هر پیش‌نویس با شناسه‌ی «userId:scope:key» نگهداری می‌شود و فقط برای صاحبش دیده می‌شود.
// ----------------------------------------------------------------------------

import { getCollection, setCollection } from "./store";

export type DraftScope = "chat" | "exam" | "hw";

export interface DraftRow {
  id: string;
  userId: string;
  scope: DraftScope;
  payload: unknown;
  updatedAt: number;
}

export const draftId = (userId: string, scope: DraftScope, key: string) => `${userId}:${scope}:${key}`;

function rows(): DraftRow[] {
  return (getCollection<DraftRow[]>("drafts") ?? []) as DraftRow[];
}

export function readDraft<T>(userId: string, scope: DraftScope, key: string): T | undefined {
  const id = draftId(userId, scope, key);
  const row = rows().find((d) => d.id === id);
  return row ? (row.payload as T) : undefined;
}

export function writeDraft(userId: string, scope: DraftScope, key: string, payload: unknown): void {
  const id = draftId(userId, scope, key);
  const next = rows().filter((d) => d.id !== id);
  next.push({ id, userId, scope, payload, updatedAt: Date.now() });
  setCollection("drafts", next);
}

export function removeDraft(userId: string, scope: DraftScope, key: string): void {
  const id = draftId(userId, scope, key);
  const list = rows();
  if (!list.some((d) => d.id === id)) return;
  setCollection("drafts", list.filter((d) => d.id !== id));
}
