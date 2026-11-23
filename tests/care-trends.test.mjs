import { test } from "node:test";
import assert from "node:assert/strict";
import { Checkins, localDay, readCheckinBackup } from "../checkins.js";
import { careStats, careReport, handoffText } from "../care-trends.js";

process.env.TZ = "America/Los_Angeles";
const now = new Date("2026-11-04T12:00:00-08:00");
const date = (text) => new Date(text);
function item(id, kind, start, details = {}) {
  const created = date(start).toISOString();
  return {
    id: id.padEnd(8, "0"),
    kind,
    title: kind,
    created,
    done: created,
    day: localDay(date(start)),
    updated: created,
    ...details,
  };
}
class Storage {
  map = new Map();
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i];
  }
  getItem(k) {
    return this.map.get(k) ?? null;
  }
  setItem(k, v) {
    this.map.set(k, v);
  }
  removeItem(k) {
    this.map.delete(k);
  }
}
test("legacy records keep unknown values and do not inflate metric denominators", () => {
  const entries = [
    item("feed", "feed", "2026-11-03T09:00"),
    item("sleep", "sleep", "2026-11-03T11:00"),
    item("diaper", "diaper", "2026-11-03T12:00"),
    item("task", "task", "2026-11-02T12:00"),
  ];
  const s = careStats(entries, 7, now);
  assert.equal(s.observed, 1);
  assert.equal(s.totals.unknownFeed, 1);
  assert.equal(s.meanInterval, null);
  for (const key of ["milk", "sleep", "stool"])
    assert.deepEqual(s.stats[key], { days: 0, total: null, average: null });
  assert.equal(s.records.length, 3);
});
test("milk totals preserve repeated feeds, optional mL, intervals over midnight and missing days", () => {
  const entries = [
    item("b1", "feed", "2026-10-30T11:00", {
      feedType: "bottle",
      amountMl: 150,
    }),
    item("b2", "feed", "2026-11-02T23:30", {
      feedType: "bottle",
      amountMl: 60,
    }),
    item("b3", "feed", "2026-11-03T00:30", {
      feedType: "bottle",
      amountMl: 90,
    }),
    item("b4", "feed", "2026-11-03T00:30", { feedType: "bottle" }),
    item("b5", "feed", "2026-11-03T03:30", { feedType: "breast" }),
  ];
  const s = careStats(entries, 7, now);
  assert.deepEqual(s.stats.milk, { days: 3, total: 300, average: 100 });
  assert.equal(s.feedCount, 5);
  assert.equal(s.feedDays, 3);
  assert.equal(s.meanInterval, 80);
  assert.equal(s.intervalCount, 3);
  assert.match(careReport(entries, 7, now), /另有 1 次瓶喂未记奶量/);
});
test("sleep splits through midnight and DST, clips to period, and merges overlaps", () => {
  const entries = [
    item("s1", "sleep", "2026-10-28T22:00", {
      sleepEnd: date("2026-10-29T01:00").toISOString(),
    }),
    item("s2", "sleep", "2026-10-31T23:30", {
      sleepEnd: date("2026-11-01T02:30-08:00").toISOString(),
    }),
    item("s3", "sleep", "2026-11-01T01:00-08:00", {
      sleepEnd: date("2026-11-01T03:00-08:00").toISOString(),
    }),
    item("s4", "sleep", "2026-11-04T08:00", { sleepEnd: null }),
  ];
  const s = careStats(entries, 7, now);
  assert.equal(s.rows[0].sleep, 60);
  assert.equal(s.rows[2].sleep, 30);
  assert.equal(s.rows[3].sleep, 240);
  assert.deepEqual(s.stats.sleep, { days: 3, total: 330, average: 110 });
  assert.equal(s.rows.at(-1).sleep, null);
  assert.equal(s.totals.running, 1);
  assert.equal(careStats(entries, 30, now).stats.sleep.total, 450);
});
test("classified wet-only days are zero, missing/ambiguous days unknown", () => {
  const entries = [
    item("w1", "diaper", "2026-11-01T12:00", { diaperType: "wet" }),
    item("w2", "diaper", "2026-11-02T12:00", { diaperType: "wet" }),
    item("any", "diaper", "2026-11-02T13:00"),
    item("m1", "diaper", "2026-11-03T13:00", { diaperType: "mixed" }),
    item("m2", "diaper", "2026-11-03T14:00", { diaperType: "dirty" }),
  ];
  const s = careStats(entries, 7, now);
  assert.deepEqual(
    s.rows.slice(-4).map((r) => r.stool),
    [0, null, 2, null],
  );
  assert.deepEqual(s.stats.stool, { days: 2, total: 2, average: 1 });
});
test("save / correct / close across midnight / conflict / migrate / backup roundtrip", async () => {
  const store = new Checkins(new Storage());
  store.profile = () => ({ caregiver: "爸爸" });
  store.saveCare(
    "sleep",
    date("2026-11-02T23:15"),
    { sleepEnd: null },
    undefined,
    now,
  );
  const original = store.backup()[0];
  assert.equal(original.caregiver, "爸爸");
  assert.throws(
    () =>
      store.saveCare(
        "sleep",
        date("2026-11-03T01:00"),
        { sleepEnd: null },
        undefined,
        now,
      ),
    /已有/,
  );
  assert.throws(
    () =>
      store.saveCare(
        "sleep",
        date("2026-11-02T23:15"),
        { sleepEnd: "2026-11-02T11:00" },
        original,
        now,
      ),
    /晚于/,
  );
  store.saveCare(
    "sleep",
    date(original.created),
    { sleepEnd: date("2026-11-03T02:45").toISOString() },
    original,
    now,
  );
  assert.throws(
    () => store.saveCare("sleep", date(original.created), {}, original, now),
    /已更新/,
  );
  const restored = new Checkins(new Storage());
  const backup = readCheckinBackup(JSON.parse(JSON.stringify(store.backup())));
  await restored.importBackup(backup);
  await restored.importBackup(backup);
  assert.deepEqual(restored.backup(), backup);
  assert.equal(careStats(backup, 7, now).stats.sleep.total, 210);
});
test("invalid enhanced records are rejected, escaped family text remains simple text", () => {
  const breast = item("breast", "feed", "2026-11-03T04:00", {
    feedType: "breast",
    amountMl: 90,
  });
  assert.throws(() => readCheckinBackup([breast]), /格式/);
  const d = item("diaper", "diaper", "2026-11-03T05:00", {
    diaperType: "mixed",
    caregiver: "外婆",
  });
  assert.match(handoffText("小麦", [d]), /11\/3 05:00  尿布 · 大小便 · 外婆/);
  assert.equal(handoffText("小麦", []), "");
});
test("native merged entries take precedence, skipped legacy items persist locally", async () => {
  const store = new Checkins(new Storage());
  const one = item("feed1", "feed", "2026-11-03T09:00", {
      feedType: "bottle",
      amountMl: 55,
    }),
    two = item("feed2", "feed", "2026-11-03T13:00");
  store.merge([one]);
  globalThis.window = new EventTarget();
  try {
    window.xiaomaiNative = {
      careEntries: [],
      mergeCare: async (items) => {
        window.xiaomaiNative.careEntries = [items.find((x) => x.id === one.id)];
        return { accepted: [one.id], skipped: [two.id] };
      },
    };
    await store.importBackup([one, two]);
    assert.equal(store.nativeIds.has(one.id), true);
    assert.deepEqual(
      store
        .backup()
        .map((i) => i.id)
        .sort(),
      [one.id, two.id],
    );
    window.xiaomaiNative.careEntries = [];
    assert.deepEqual(store.backup(), [two]);
  } finally {
    delete globalThis.window;
  }
});

test("a historical diary counts sleep that finished the next morning", () => {
  const sleep = item("night", "sleep", "2026-11-02T22:30:00-08:00", {
    sleepEnd: "2026-11-03T06:30:00-08:00",
  });
  const historical = careStats(
    [sleep],
    7,
    now,
    new Date("2026-11-02T12:00:00-08:00"),
  );
  assert.equal(historical.rows.at(-1).sleep, 90);
});
