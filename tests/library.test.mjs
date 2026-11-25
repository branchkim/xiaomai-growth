import assert from "node:assert/strict";
import test from "node:test";
import { availableFilters, findCards, makeSearchIndex } from "../library.js";

const stages = [
  { id: "first", window: [0, 12], label: "未满一岁", name: "初见" },
  { id: "later", window: [12, 36], label: "一至三岁", name: "一起动手" },
];
const basic = { topic: "生活参与", aliases: [], scene: "穿衣", reason: "从生活中学习", steps: ["一起做"] };
const cards = [
  { ...basic, id: "baby", title: "亲子交流", stage: "first", observation: "看向你" },
  { ...basic, id: "sticky", title: "拉鞋带", stage: "later", activity: {
    title: "一起拉开粘扣", window: [12, 18], observe: "尝试握住布条", lens: "蒙氏",
  } },
  { ...basic, id: "socks", title: "配袜子", stage: "later", activity: {
    window: [15, 30], observe: "寻找一样的花纹", lens: "蒙氏",
  } },
];
const data = { stages, cards }, index = makeSearchIndex(data);
const ids = (filters) => findCards(index, filters).map((c) => c.id);

test("满月龄筛选返回交叉年龄窗；未满上限，保留旧版适龄区间链接", () => {
  assert.deepEqual(ids({ age: "15" }), ["sticky", "socks"]);
  assert.deepEqual(ids({ age: "18" }), ["socks"]);
  assert.deepEqual(ids({ age: "30" }), []);
  assert.deepEqual(ids({ age: "12-18" }), ["sticky"]);
  assert.deepEqual(ids({ age: "0" }), ["baby"]);
  assert.deepEqual(availableFilters(data).age.at(-1), ["35", "满 35 个月"]);
});

test("月龄文字、主题与家庭观察一起检索，章节序数区别于已满月龄", () => {
  for (const q of ["１５个月袜子", "1岁3个月 袜子", "十五个月 寻找一样的花纹",
    "1岁半 袜子", "满18月龄 袜子", "18–24个月 袜子"]) assert.deepEqual(ids({ q }), ["socks"], q);
  assert.deepEqual(ids({ q: "第十二个月" }), ["baby"]);
  assert.deepEqual(ids({ q: "未满1个月 看向你" }), ["baby"]);
  assert.deepEqual(ids({ q: "36个月" }), []);
  assert.deepEqual(ids({ age: "15", lens: "蒙氏", q: "布条" }), ["sticky"]);
});


test("阶段标签的末月仍在范围内，教育视角支持常见译名", () => {
  const extra = { ...basic, id: "last", title: "家里的袜子", stage: "later", activity: {
    window: [23, 24], observe: "摸方向", lens: "蒙台梭利·日常生活",
  } };
  const entries = makeSearchIndex({ stages, cards: [...cards, extra] });
  for (const q of ["满18–23月龄 蒙氏", "18–23月龄 蒙特梭利", "已满23个月 Montessori"]) {
    assert(findCards(entries, { q }).some((c) => c.id === "last"), q);
  }
  assert(!findCards(entries, { q: "满18至未满23个月 蒙氏" }).some((c) => c.id === "last"));
});
