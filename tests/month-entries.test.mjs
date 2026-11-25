import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { familyObservations, gameCopy, monthMaterial, monthTip, safetyGroups } from "../month-entries.js";

const { cards } = JSON.parse(readFileSync(new URL("../cards.json", import.meta.url)));
const activities = cards.filter((card) => card.activity);

test("every game card has a short distinct title, a home action, an observable behaviour, and materials", () => {
  assert.deepEqual(Object.keys(gameCopy).sort(), activities.map((card) => card.id).sort());
  const titles = new Set();
  for (const { id } of activities) {
    const { title, how, observation, material } = gameCopy[id];
    assert.ok(title.length > 0 && title.length <= 12, id);
    assert.ok(how.length > 0 && how.length <= 56, id);
    assert.ok(observation.length > 0 && material.length > 0, id);
    titles.add(title);
  }
  assert.equal(titles.size, activities.length);
});

test("all 36 months show materials and observations using the original card windows and stable IDs", () => {
  for (let month = 0; month < 36; month++) {
    const expected = activities.filter(({ activity }) => month >= activity.window[0] && month < activity.window[1]);
    const observed = familyObservations(month, cards);
    assert.ok(observed.length >= 2, "家庭观察不应有空白月份：" + month);
    assert.deepEqual(observed.map((item) => item.cardId), expected.map((card) => card.id));
    for (const item of observed) {
      assert.equal(item.id, "family-" + item.cardId);
      assert.equal(item.title, gameCopy[item.cardId].observation);
    }
    assert.ok(monthTip(month));
    for (const value of Object.values(monthMaterial(month))) assert.ok(value);
  }
  assert.equal(monthTip(36), "");
  assert.equal(monthMaterial(-1), null);
  assert.deepEqual(familyObservations(36, cards), []);
});

test("health guidance separates urgent, consultation and home steps and respects age thresholds", () => {
  for (let month = 0; month < 36; month++) {
    const groups = safetyGroups(month);
    assert.deepEqual(groups.map((group) => group.level), ["urgent", "consult", "routine"]);
    for (const group of groups) {
      assert.ok(group.items.every((item) => item.title && item.how));
      assert.match(group.source.url, /^https:\/\//);
    }
    const urgent = groups[0].items.map((item) => item.title).join(" ");
    assert.match(urgent, /呼吸/);
    assert.equal(urgent.includes("38°C"), month < 3);
    assert.equal(urgent.includes("39°C"), month >= 3 && month < 6);
  }
  assert.match(safetyGroups(0)[1].items[0].title, /灰、发白/);
  assert.match(safetyGroups(18)[1].items[0].title, /18/);
  assert.deepEqual(safetyGroups(36), []);
});
