import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { guideCardIds, guideHash, guideTopics, guideLink, readGuide } from "../book-guide.js";
import { bookResources } from "../book-resources.js";
import { makeSearchIndex, findCards } from "../library.js";

const data = JSON.parse(await readFile(new URL("../cards.json", import.meta.url)));
const cards = new Map(data.cards.map(card => [card.id, card]));

test("公开的十章及章后资料各自对应可读的小麦实践卡", () => {
  assert.deepEqual(guideTopics.slice(0, 10).map(t => t.label),
    Array.from({ length: 10 }, (_, i) => "第 " + (i + 1) + " 章"));
  assert.deepEqual(guideTopics.slice(10).map(t => t.title), ["家庭实例", "附录"]);
  assert.equal(new Set(guideTopics.map(t => t.id)).size, guideTopics.length);
  for (const topic of guideTopics) {
    assert.ok(topic.prompt && topic.cards.length);
    for (const id of topic.cards) assert.ok(cards.has(id), topic.id + " / " + id);
  }
  assert.deepEqual(new Set(guideCardIds), new Set(guideTopics.flatMap(t => t.cards)));
});

test("切换书中主题与返回全部专题卡保留用户筛选，独立链接可恢复状态", () => {
  assert.equal(guideLink(null, null), guideHash);
  const initial = new URLSearchParams({ age: "0", q: "换片", favorite: "1" });
  const selected = guideTopics.find(t => t.id === "home");
  const fromHash = hash => new URLSearchParams(hash.split("?")[1]);
  const deeper = fromHash(guideLink(initial, selected));
  assert.equal(readGuide(deeper).topic, selected);
  const all = fromHash(guideLink(deeper, null));
  assert.equal(readGuide(all).topic, null);
  for (const [key, val] of initial) assert.equal(all.get(key), val);
  assert.equal(readGuide(new URLSearchParams()), null);
  assert.equal(readGuide(fromHash(guideHash + "&theme=expired")).topic, null);
});

test("书名查到相关家庭实践；官方配套资料维持为独立英文链接", () => {
  const aliases = ["蒙台梭利婴儿", "The Montessori Baby"];
  const index = makeSearchIndex(data, new Map(guideCardIds.map(id => [id, aliases])));
  for (const q of ["蒙氏婴儿", "The Montessori Baby"]) {
    assert.deepEqual(new Set(findCards(index, { q }).map(c => c.id)), new Set(guideCardIds));
  }
  assert.equal(bookResources.length, 12);
  assert.equal(new Set(bookResources.map(r => r.url)).size, 12);
  for (const item of bookResources) assert.ok(item.label && item.note && item.group &&
    item.url.startsWith("https://www.hachettebookgroup.com/"));
});
