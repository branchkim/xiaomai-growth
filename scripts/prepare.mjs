import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const read = (name) => readFile(new URL(name, root));
const data = JSON.parse(await read("cards.json"));
const cards = new Map(data.cards.map((c) => [c.id, c]));
const stages = new Set(data.stages.map((s) => s.id));
assert.equal(cards.size, data.cards.length, "卡片编号重复");
assert.equal(stages.size, data.stages.length, "时间线阶段重复");
let nextMonth = 0;
for (const s of data.stages) {
  assert.ok(Array.isArray(s.window) && s.window.length === 2 &&
    s.window[0] === nextMonth && Number.isInteger(s.window[1]) && s.window[1] > nextMonth,
    s.id + " 月龄时间线应连续");
  nextMonth = s.window[1];
  assert.ok(
    s.focus &&
      s.featured.length &&
      s.featured.every((id) => cards.get(id)?.stage === s.id),
    s.id,
  );
  await read("assets/stage-" + (s.art || s.id) + ".webp");
}
for (const c of data.cards) {
  assert.ok(
    stages.has(c.stage) &&
      c.title &&
      c.reason &&
      (c.observation || c.activity?.observe) &&
      c.steps?.length &&
      c.steps.every(Boolean),
    c.id,
  );
  assert.ok(
    c.topic &&
      c.scene &&
      Array.isArray(c.aliases) &&
      c.reference.startsWith("https://"),
    c.id,
  );
  assert.ok(
    (c.related || []).every((id) => cards.has(id)),
    c.id,
  );
  if (c.activity) {
    const { window, sources, signal, materials, stop, observe, lens } =
      c.activity;
    assert.ok(
      Number.isInteger(window[0]) && Number.isInteger(window[1]) &&
        window[0] >= 0 && window[1] <= nextMonth &&
        window[1] > window[0] &&
        signal &&
        materials &&
        stop &&
        observe &&
        lens,
      c.id,
    );
    assert.ok(
      sources.length &&
        sources.every((id) => data.sources[id]?.url.startsWith("https://") && data.sources[id].role && data.sources[id].title),
      c.id,
    );
  }
}
const shell = (await readdir(root, { withFileTypes: true }))
  .filter(
    (e) =>
      e.isFile() &&
      e.name !== "sw.js" &&
      /\.(js|css|html|json|webmanifest)$/.test(e.name),
  )
  .map((e) => e.name);
const assets = await readdir(new URL("assets/", root), { withFileTypes: true });
const paths = [
  ...shell,
  ...assets
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => "assets/" + e.name),
].sort();
const template = (await read("scripts/sw-template.js")).toString();
const hash = createHash("sha256").update(template);
for (const name of paths) hash.update(name).update(await read(name));
const sw = template
  .replace("__VERSION__", hash.digest("hex").slice(0, 14))
  .replace("__FILES__", JSON.stringify(paths));
await writeFile(new URL("sw.js", root), sw);
console.log(
  "已校验 " +
    stages.size +
    " 个阶段、" +
    cards.size +
    " 张卡片和 " +
    paths.length +
    " 个离线资源。",
);
