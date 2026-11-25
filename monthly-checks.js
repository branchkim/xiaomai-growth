import { localDay } from "./checkins.js";
import { validDay } from "./growth-store.js";
import { plans } from "./health.js";

export function setPlayed(store, cardId, title, done, day = localDay()) {
  const id = "day-" + day + "-" + cardId;
  if (done) store.put("activity", id, { cardId, title, date: day });
  else store.remove("activity", id);
}

export function canUndoRecentObservation(recorded, key, actual, day = localDay()) {
  return recorded.get(key) === day && actual === day;
}

export function setObserved(store, item, done, expectedDate, day = localDay()) {
  const old = store.list("milestone").find(r => r.id === item.id);
  if (done) {
    if (!old?.date) store.put("milestone", item.id, { ...old, title: item.title, date: day, note: old?.note || "" });
  } else if (old?.date === expectedDate) {
    if (old.note) store.put("milestone", item.id, { ...old, date: "" });
    else store.remove("milestone", item.id);
  }
}

export function setVisitActual(ctx, id, date, expectedDate, day = localDay()) {
  const visit = plans(ctx).find(p => p.id === id);
  if (!visit || visit.actual !== expectedDate)
    throw Error("这项记录已有更新，请重新打开核对。");
  const birth = ctx.profile().birthday;
  if (date && (!validDay(date) || date > day || (birth && date < birth)))
    throw Error("请核对实际日期，选择出生至今天之间的一天。");
  const values = { appointment: "", note: "", ...visit.record, actual: date };
  ctx.store.put("visit", id, values);
  if (date && ctx.cancelReminder)
    Promise.resolve().then(() => ctx.cancelReminder(id)).catch(() => ctx.notify("已保存日期，请在系统中核对旧提醒。"));
}
