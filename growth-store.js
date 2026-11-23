import { localDay } from "./checkins.js";

const prefix = "xiaomai/growth/v1/";
const types = ["profile", "measurement", "visit", "milestone", "activity"];
const validId = (id) => typeof id === "string" && /^[\w.:-]{1,160}$/u.test(id);
export function validDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(value + "T12:00:00");
  return Number.isFinite(+d) && localDay(d) === value;
}
export function monthsOld(birthday, day = localDay()) {
  if (!validDay(birthday) || !validDay(day) || day < birthday) return null;
  const [y, m, d] = day.split("-").map(Number);
  const [by, bm, bd] = birthday.split("-").map(Number);
  const anniversaryDay = Math.min(bd, new Date(y, m, 0).getDate());
  return (y - by) * 12 + m - bm - (d < anniversaryDay ? 1 : 0);
}
export function lifeDay(birthday, day) {
  return validDay(birthday) && validDay(day) && day >= birthday
    ? Math.round(
        (Date.parse(day + "T00:00:00Z") - Date.parse(birthday + "T00:00:00Z")) /
          86400000,
      ) + 1
    : null;
}
export const profileDefaults = {
  name: "小麦",
  birthday: "",
  sex: "",
  feeding: "",
  amount: "",
  members: [],
  caregiver: "",
  leadDays: 1,
  reminders: { plan: true, observation: true, activity: true },
};
function validProfile(p) {
  return (
    typeof p.name === "string" &&
    p.name.trim() &&
    p.name.length <= 40 &&
    (p.birthday === "" || validDay(p.birthday)) &&
    ["", "male", "female"].includes(p.sex) &&
    Array.isArray(p.members) &&
    p.members.every((m) => typeof m === "string" && m.length <= 40) &&
    typeof p.caregiver === "string" &&
    ["", "breast", "bottle", "mixed"].includes(p.feeding) &&
    (p.milkSource == null ||
      ["", "formula", "expressed"].includes(p.milkSource)) &&
    (p.amount === "" ||
      (Number.isInteger(+p.amount) && +p.amount > 0 && +p.amount <= 2000)) &&
    [0, 1, 3, 7].includes(p.leadDays) &&
    p.reminders &&
    ["plan", "observation", "activity"].every(
      (k) => typeof p.reminders[k] === "boolean",
    )
  );
}
function validFields(type, f) {
  const text = (x, max) => typeof x === "string" && x.length <= max;
  if (type === "activity")
    return validDay(f.date) && text(f.title, 500) && text(f.cardId, 160);
  if (type === "measurement") {
    const keys = ["weight", "length", "head"];
    return (
      validDay(f.date) &&
      keys.some((k) => f[k] > 0) &&
      keys.every(
        (k) =>
          f[k] == null ||
          (typeof f[k] === "number" &&
            f[k] > 0 &&
            f[k] <= (k === "weight" ? 100 : 200)),
      )
    );
  }
  if (type === "milestone")
    return (
      (validDay(f.date) || (f.date === "" && Boolean(f.note))) &&
      text(f.note, 500)
    );
  if (type === "visit")
    return (
      [f.appointment, f.actual].every((d) => d === "" || validDay(d)) &&
      text(f.note, 500) &&
      (f.course == null || ["", "inactive", "live"].includes(f.course)) &&
      (!f.custom ||
        (text(f.title, 70) &&
          ["custom", "optional"].includes(f.kind) &&
          Number.isInteger(f.month) &&
          f.month >= 0 &&
          f.month <= 12))
    );
  return true;
}
export function validateGrowthRecords(rows = []) {
  if (!Array.isArray(rows)) throw Error("成长资料备份格式有误。");
  const seen = new Set();
  for (const row of rows) {
    if (
      !row ||
      !types.includes(row.type) ||
      !validId(row.id) ||
      !row.fields ||
      Array.isArray(row.fields) ||
      typeof row.fields !== "object" ||
      !Number.isFinite(Date.parse(row.updated)) ||
      seen.has(row.type + "/" + row.id) ||
      !validFields(row.type, row.fields) ||
      (row.type === "profile" &&
        (row.id !== "baby" || !validProfile(row.fields)))
    )
      throw Error("成长资料备份格式有误。");
    seen.add(row.type + "/" + row.id);
  }
  return rows;
}
export class GrowthStore {
  constructor(storage) {
    this.storage = storage;
  }
  list(type) {
    return this.snapshot(type).map((r) => ({ ...r.fields, id: r.id }));
  }
  snapshot(type) {
    const rows = [];
    if (!this.storage) return rows;
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (!k?.startsWith(prefix + (type ? type + "/" : ""))) continue;
      const row = JSON.parse(this.storage.getItem(k));
      rows.push(row);
    }
    return rows;
  }
  put(type, id, fields, updated = new Date().toISOString()) {
    const row = { type, id, fields: { ...fields }, updated };
    delete row.fields.id;
    validateGrowthRecords([row]);
    if (!this.storage) throw Error("浏览器未开放本机存储。");
    this.storage.setItem(prefix + type + "/" + id, JSON.stringify(row));
  }
  remove(type, id) {
    if (!this.storage) throw Error("浏览器未开放本机存储。");
    this.storage.removeItem(prefix + type + "/" + id);
  }
  merge(rows) {
    for (const r of validateGrowthRecords(rows)) {
      const local = this.storage?.getItem(prefix + r.type + "/" + r.id);
      if (
        !local ||
        Date.parse(JSON.parse(local).updated) < Date.parse(r.updated)
      )
        this.put(r.type, r.id, r.fields, r.updated);
    }
  }
  profile() {
    return {
      ...profileDefaults,
      ...this.list("profile").find((r) => r.id === "baby"),
    };
  }
}
export function asDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error("文件读取失败。"));
    reader.readAsDataURL(blob);
  });
}
export async function saveFile(blob, name) {
  if (window.xiaomaiNative?.shareFile) {
    const url = await asDataURL(blob);
    return window.xiaomaiNative.shareFile({
      name,
      mime: blob.type,
      base64: url.split(",")[1],
    });
  }
  const a = document.createElement("a");
  a.download = name;
  a.href = URL.createObjectURL(blob);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
