import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    assert(
      items.some((x) => x.kind === "alert"),
      "no warnings at " + m,
    );
    assert.equal(
      items.filter((x) => x.kind === "plan").length > 0,
      [0, 1, 2, 3, 4, 6, 8, 9, 12].includes(m),
    );
    for (const item of items.filter((x) => x.kind === "play")) {
      const card = cards.find((c) => "#card/" + c.id === item.href);
      assert(m >= card.activity.window[0] && m < card.activity.window[1]);
    }
    if (![0, 3, 6, 8, 12].includes(m))
      assert.equal(items.find((x) => x.kind === "alert").urgent, true);
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
        x.action === "已记录",
    ),
  );
  assert(
    items.some(
      (x) =>
        x.href === "#growth/plan?visit=ipv-2" &&
        x.note.includes("2026-12-03") &&
        x.action === "已预约",
    ),
  );
  assert(items.some((x) => x.title === "带手册复诊" && x.action === "已记录"));
  assert(
    items.some((x) => x.href === "#card/" + card && x.action === "已玩过"),
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
