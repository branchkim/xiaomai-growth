import { readCheckinBackup } from "./checkins.js";

// Keys use permanent card IDs so renaming or reordering cards preserves the family's entries.
const prefix = "xiaomai/notes/v1/";
export const conflictDivider = "\n\n—— 另一份记录 ——\n\n";
const favoritePrefix = "xiaomai/favorites/v1/";
export function parseNotebookBackup(text, knownIds) {
  const data = JSON.parse(text);
  if (
    data?.app !== "xiaomai-growth" ||
    data.version !== 1 ||
    !Array.isArray(data.entries)
  )
    throw new Error("请选择由本手账导出的 JSON 备份。");
  const seen = new Set();
  for (const item of data.entries) {
    if (
      !item ||
      !knownIds.has(item.id) ||
      seen.has(item.id) ||
      typeof item.text !== "string" ||
      !item.text.trim() ||
      !Number.isFinite(Date.parse(item.updated))
    ) {
      throw new Error("这份备份的格式或卡片编号不匹配，原有经验已保留。");
    }
    seen.add(item.id);
  }
  const favorites = data.favorites ?? [];
  if (!Array.isArray(favorites) || !favorites.every((id) => knownIds.has(id)))
    throw new Error("收藏编号有误，请检查备份。");
  return {
    entries: data.entries,
    favorites: [...new Set(favorites)],
    checkins: readCheckinBackup(data.checkins),
  };
}
export function parseBackup(text, knownIds) {
  return parseNotebookBackup(text, knownIds).entries;
}
export function mergeEntry(current, incoming) {
  if (!current) return { text: incoming.text, updated: incoming.updated };
  if (current.text === incoming.text) return current;
  const parts = [
    ...new Set([
      ...current.text.split(conflictDivider),
      ...incoming.text.split(conflictDivider),
    ]),
  ];
  return {
    text: parts.join(conflictDivider),
    updated:
      Date.parse(current.updated) >= Date.parse(incoming.updated)
        ? current.updated
        : incoming.updated,
  };
}
export class Notebook {
  constructor(storage, ids) {
    this.storage = storage;
    this.ids = ids;
    this.favorites = new Set();
    this.unsavedFavorites = new Set();
    this.entries = new Map();
    this.pending = new Set();
    this.read();
  }
  read() {
    if (!this.storage) return;
    for (const id of this.ids) {
      if (!this.unsavedFavorites.has(id)) {
        try {
          if (this.storage.getItem(favoritePrefix + id) === "1")
            this.favorites.add(id);
          else this.favorites.delete(id);
        } catch {
          /* Keep in-memory bookmarks when storage is unavailable. */
        }
      }
      if (this.pending.has(id)) continue;
      try {
        const item = JSON.parse(this.storage.getItem(prefix + id));
        if (
          item &&
          typeof item.text === "string" &&
          typeof item.updated === "string"
        )
          this.entries.set(id, item);
        else this.entries.delete(id);
      } catch {
        /* An unreadable entry must not prevent access to other cards. */
      }
    }
  }
  set(id, text, updated = new Date().toISOString()) {
    if (!this.ids.has(id)) throw new Error("未知的卡片");
    const item = { text, updated };
    if (text.trim()) this.entries.set(id, item);
    else this.entries.delete(id);
    try {
      if (!this.storage) throw new Error("storage");
      if (text.trim()) this.storage.setItem(prefix + id, JSON.stringify(item));
      else this.storage.removeItem(prefix + id);
      this.pending.delete(id);
      return true;
    } catch {
      this.pending.add(id);
      return false;
    }
  }
  setFavorite(id, selected) {
    if (!this.ids.has(id)) throw new Error("未知的卡片");
    if (selected) this.favorites.add(id);
    else this.favorites.delete(id);
    try {
      if (!this.storage) throw new Error("storage");
      if (selected) this.storage.setItem(favoritePrefix + id, "1");
      else this.storage.removeItem(favoritePrefix + id);
      this.unsavedFavorites.delete(id);
      return true;
    } catch {
      this.unsavedFavorites.add(id);
      return false;
    }
  }
  backup() {
    this.read();
    return {
      app: "xiaomai-growth",
      version: 1,
      favorites: [...this.favorites],
      exported: new Date().toISOString(),
      entries: [...this.entries].map(([id, item]) => ({ id, ...item })),
    };
  }
}
