import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dashboardItems } from "../growth-dashboard.js";

const data = JSON.parse(readFileSync(new URL("../cards.json", import.meta.url)));
const practice = data.cards.filter(card => card.id.startsWith("mb-"));

test("家庭实践卡标明参考资料的用途，照护者笔记也有观察问题", () => {
  assert.ok(practice.some(card => !card.activity));
  for (const card of practice) {
    const sources = (card.activity?.sources || card.sources).map(id => data.sources[id]);
    assert.ok(sources.every(source => source?.role && source.title && source.url.startsWith("https://")), card.id);
    assert.ok(sources.some(source => source.url === card.reference), card.id);
    assert.ok(card.steps.length && card.reason && (card.observation || card.activity?.observe), card.id);
  }
});

test("出生到周岁每月有专题游戏，照护者休息和家庭交班只作为笔记", () => {
  const ctx = {
    cards: data.cards, store: { list: () => [] },
    profile: () => ({ birthday: "", reminders: {} }),
  };
  for (let month = 0; month <= 12; month++) {
    const items = dashboardItems(ctx, month, "2026-02-18").filter(item =>
      item.kind === "play" && item.id.startsWith("mb-"));
    assert.ok(items.length, "在满 " + month + " 个月可玩的游戏");
    for (const item of items) {
      assert.ok(practice.find(card => card.id === item.id).activity);
      assert.equal(item.action, "今天玩过");
    }
  }
});
