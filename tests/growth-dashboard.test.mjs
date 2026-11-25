import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safetyGroups } from "../month-entries.js";
import { canUndoRecentObservation, setObserved, setPlayed, setVisitActual } from "../monthly-checks.js";
import { healthReport } from "../health.js";
import { dashboardItems, visitTiming } from "../growth-dashboard.js";

const { cards } = JSON.parse(
  readFileSync(new URL("../cards.json", import.meta.url)),
);
const profile = {
  birthday: "",
  reminders: { activity: true, observation: true, plan: true },
};
function context(rows = {}) {
  return {
    cards,
    profile: () => profile,
    store: { list: (type) => rows[type] || [] },
  };
}

test("month sections are browsable without a profile; scheduled health data stays within its scope", () => {
  const ctx = context();
  for (let m = 0; m < 36; m++) {
    const items = dashboardItems(ctx, m);
    assert(
      items.some((x) => x.kind === "play"),
      "no activities at " + m,
    );
    assert(
      items.some((x) => x.kind === "develop"),
      "no observations at " + m,
    );
    assert.deepEqual(safetyGroups(m).map(group => group.level), ["urgent", "consult", "routine"]);
    assert.equal(
      items.filter((x) => x.kind === "plan").length > 0,
      [0, 1, 2, 3, 4, 6, 8, 9, 12].includes(m),
    );
    for (const item of items.filter((x) => x.kind === "play")) {
      const card = cards.find((c) => "#card/" + c.id === item.href);
      assert(m >= card.activity.window[0] && m < card.activity.window[1]);
    }
    assert(items.filter(x => x.kind === "develop").every(x => x.id && x.note));
  }
});
test("appointments, completed milestones, tried games and saved custom visits link to their original record", () => {
  const card = dashboardItems(context(), 3)
    .find((x) => x.kind === "play")
    .href.slice(6);
  const items = dashboardItems(
    context({
      milestone: [{ id: "mark-3-head-up", date: "2026-10-09", note: "" }],
      activity: [{ id: "first-" + card, date: "2026-10-01", cardId: card }],
      visit: [
        { id: "ipv-2", appointment: "2026-12-03" },
        {
          id: "myvisit",
          custom: true,
          kind: "custom",
          month: 3,
          title: "带手册复诊",
          actual: "2026-11-14",
        },
      ],
    }),
    3,
  );
  assert(
    items.some(
      (x) =>
        x.href === "#growth/observe?month=3&mark=mark-3-head-up" &&
        x.action === "已做到",
    ),
  );
  assert(
    items.some(
      (x) =>
        x.href === "#growth/plan?visit=ipv-2" &&
        x.note.includes("2026-12-03") &&
        x.action === "记日期",
    ),
  );
  assert(items.some((x) => x.title === "带手册复诊" && x.action === "已记录"));
  assert(
    items.some((x) => x.href === "#card/" + card && x.kind === "play" && x.action === "今天玩过"),
  );
});

test("confirmed appointments and reference dates use distinct calendar-day labels", () => {
  assert.equal(
    visitTiming({ target: "2024-03-01" }, "2024-02-28"),
    "距参考日 2 天",
  );
  assert.equal(
    visitTiming(
      { target: "2024-03-01", appointment: "2024-02-29" },
      "2024-02-28",
    ),
    "距预约 1 天",
  );
  assert.equal(
    visitTiming({ target: "2024-02-28" }, "2024-02-28"),
    "今天到参考月龄",
  );
  assert.equal(
    visitTiming({ appointment: "2024-02-28" }, "2024-02-28"),
    "今天已预约",
  );
  assert.equal(
    visitTiming({ target: "2024-02-27" }, "2024-02-28"),
    "已到参考月龄 · 待核对",
  );
  assert.equal(
    visitTiming({ appointment: "2024-02-27" }, "2024-02-28"),
    "预约 02/27 · 待核对",
  );
  assert.equal(visitTiming({}, "2024-02-28"), "");
});

test("inline checks separate daily play, first observation and the visit's actual date", () => {
  const rows = {
    activity: [{ id: "first-edu-humming", date: "2026-10-08", cardId: "edu-humming", title: "轻哼" }],
    milestone: [{ id: "family-edu-humming", note: "奶奶在场", date: "" }],
    visit: [{ id: "hepb-1", appointment: "2026-11-24", actual: "", note: "带手册", course: "live" }],
  };
  const ctx = context(rows), day = "2026-11-24";
  ctx.profile = () => ({...profile, birthday:"2026-10-07"});
  ctx.store.remove = (type, id) => { rows[type] = rows[type].filter(r => r.id !== id); };
  ctx.store.put = (type, id, values) => {
    ctx.store.remove(type, id);
    rows[type].push({...values, id});
  };
  const find = (kind, id) => dashboardItems(ctx, 0, day).find(x => x.kind === kind && x.id === id);
  const game = find("play", "edu-humming");
  setPlayed(ctx.store, game.id, game.title, true, day);
  assert.equal(find("play",game.id).done, true);
  assert.equal(dashboardItems(ctx,0,"2026-11-25").find(x => x.id === game.id).done,false);
  setPlayed(ctx.store, game.id, game.title, false, day);
  assert.equal(rows.activity.length, 1);
  assert.equal(rows.activity[0].id, "first-edu-humming");
  const item = find("develop","family-edu-humming");
  setObserved(ctx.store, item, true, "", day);
  setObserved(ctx.store, item, true, "", "2026-11-25");
  assert.equal(find("develop",item.id).date,day);
  assert(healthReport(ctx).includes("奶奶在场"));
  setObserved(ctx.store, item, false, day);
  assert.equal(rows.milestone[0].note, "奶奶在场");
  assert.equal(rows.milestone[0].date, "");
  assert.throws(() => setVisitActual(ctx,"hepb-1","2026-10-01","",day));
  assert.throws(() => setVisitActual(ctx,"hepb-1","2026-11-25","",day));
  setVisitActual(ctx,"hepb-1","2026-11-23","",day);
  assert.equal(rows.visit[0].appointment,"2026-11-24");
  assert.equal(rows.visit[0].note,"带手册");
  assert.equal(rows.visit[0].course,"live");
  assert.throws(() => setVisitActual(ctx,"hepb-1","","",day));
  setVisitActual(ctx,"hepb-1","","2026-11-23",day);
  assert.equal(rows.visit[0].actual,"");
  assert.equal(rows.visit[0].appointment,"2026-11-24");
});

test("only a same-session observation with the original date can be undone without confirmation", () => {
  const key = "develop/mark-3-head-up", fresh = new Map([[key, "2026-11-24"]]);
  assert(canUndoRecentObservation(fresh,key,"2026-11-24","2026-11-24"));
  assert(!canUndoRecentObservation(fresh,key,"2026-11-23","2026-11-24")); // another open editor corrected it
  assert(!canUndoRecentObservation(fresh,key,"2026-11-24","2026-11-25")); // midnight
  assert(!canUndoRecentObservation(new Map(),key,"2026-11-24","2026-11-24"));
});
