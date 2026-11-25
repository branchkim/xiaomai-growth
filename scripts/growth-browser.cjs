// PLAYWRIGHT_PATH may point to an existing installation of Playwright.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const root = path.join(__dirname, "..");
const types = {
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  webp: "image/webp",
  png: "image/png",
  json: "application/json",
  webmanifest: "application/manifest+json",
};
async function openDiarySection(page, title) {
  const summary = page.locator("summary").filter({ hasText: title }).first();
  if (!(await summary.evaluate((element) => element.parentElement.open))) await summary.click();
}
async function run() {
  const server = http.createServer(async (req, res) => {
    try {
      const f =
        decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(
          1,
        ) || "index.html";
      if (f.includes("..")) throw Error();
      const b = await fs.readFile(path.join(root, f));
      res.writeHead(200, {
        "Content-Type":
          types[f.split(".").at(-1)] || "application/octet-stream",
      });
      res.end(b);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const url = "http://127.0.0.1:" + server.address().port + "/";
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome" });
    const make = () =>
      browser.newContext({
        viewport: { width: 390, height: 844 },
        timezoneId: "Asia/Shanghai",
        acceptDownloads: true,
      });
    const context = await make(),
      p = await context.newPage();
    p.setDefaultTimeout(8000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(url);
    const dashboard = p.locator(".growth-dashboard");
    await dashboard.waitFor();
    await dashboard.getByRole("heading", { name: "今日关注" }).waitFor();
    await dashboard.getByRole("heading", { name: "生长曲线" }).waitFor();
    await dashboard.locator('[data-dash-month="18"]').click();
    await dashboard.locator('[data-dash-category="play"]').click();
    const socksInDashboard = dashboard.locator('.dash-items a[href*="edu-sock-pairs"]').first();
    const played = dashboard.locator('[data-dash-check="play/edu-sock-pairs"]').first();
    const selectedURL = p.url();
    await played.click();
    assert.equal(p.url(), selectedURL);
    assert.equal(await played.getAttribute("aria-pressed"), "true");
    await p.reload();
    await dashboard.waitFor();
    assert.equal(await played.getAttribute("aria-pressed"), "true");
    await played.click();
    assert.equal(await played.getAttribute("aria-pressed"), "false");
    await socksInDashboard.scrollIntoViewIfNeeded();
    const listScroll = await p.evaluate(() => scrollY);
    await socksInDashboard.click();
    await p.getByRole("button", { name: "关闭卡片" }).click();
    await p.waitForURL(/#growth\/dashboard\?month=18&category=play$/);
    await dashboard.locator('[data-dash-month="18"][aria-pressed="true"]').waitFor();
    assert.ok(listScroll > 0 && Math.abs(await p.evaluate(() => scrollY) - listScroll) < 16,
      "从活动卡返回时应保留列表的阅读位置");
    await dashboard.locator('[data-dash-metric="head"]').click();
    assert.equal(await dashboard.locator('[data-dash-metric="head"]').getAttribute("aria-pressed"), "true");
    await dashboard.locator('[data-dash-category="develop"]').click();
    await dashboard.locator('[data-dash-month="3"]').click();
    assert.equal(await dashboard.locator(".dash-ranges .dash-range-row").count(), 3);
    const milestone = dashboard.locator('[data-dash-check="develop/mark-3-head-up"]').first();
    await milestone.click();
    assert.equal(await milestone.getAttribute("aria-pressed"), "true");
    await dashboard.locator('[data-dash-month="0"]').click();
    await dashboard.locator('[data-dash-category="alert"]').click();
    await dashboard.locator(".dash-warning.urgent").first().waitFor();
    assert.equal(await dashboard.locator(".dash-warning button[data-dash-check]").count(), 0);
    await dashboard.locator('[data-dash-category="plan"]').click();
    await dashboard.locator('[data-dash-check="plan/hepb-1"]').first().click();
    const visit = dashboard.locator(".month-visit-form");
    const actualDate = await p.evaluate(async () => (await import("./checkins.js")).localDay());
    await visit.locator('input[type="date"]').fill(actualDate);
    await visit.getByRole("button", {name: "保存日期"}).click();
    const recordedVisit = await p.evaluate(async () => {
      const {GrowthStore} = await import("./growth-store.js");
      return new GrowthStore(localStorage).list("visit").find((r) => r.id === "hepb-1");
    });
    assert.equal(recordedVisit.actual, actualDate);
    await dashboard.locator('.dash-utilities a[href="#growth/stats"]').click();
    await p.getByRole("button", {name:"近 30 天"}).click();
    assert.equal(await p.getByRole("button", {name:"近 30 天"}).getAttribute("aria-pressed"), "true");
    await p.locator("#growth-back").click();
    await dashboard.locator('a[href="#growth/profile"]').first().click();
    await p.locator('[name="name"]').fill("测试麦穗");
    const birth = new Date();
    birth.setMonth(birth.getMonth() - 5);
    await p.locator("[name=birthday]").fill(birth.toISOString().slice(0, 10));
    await p.locator("[name=sex]").selectOption("female");
    await p.locator("[name=feeding]").selectOption("bottle");
    await p.locator("[name=amount]").fill("95");
    await p.locator("[name=members]").fill("爸爸、奶奶");
    await p.locator("[name=caregiver]").selectOption("爸爸");
    await p.getByRole("button", { name: "保存家庭设置" }).click();
    await p.goto(url + "#home");
    await p.locator(".focus-check[aria-pressed]").click();
    assert.equal(
      await p
        .locator(".focus-check[aria-pressed]")
        .getAttribute("aria-pressed"),
      "true",
    );
    await p.locator("#quick-checkins [data-kind=feed]").click();
    await p.goto(url + "#growth");
    assert.equal(await p.locator(".tool-tile").count(), 8);
    await p.locator('a[href="#growth/play"].tool-tile').click();
    await p.locator(".play-entry a").first().click();
    await p
      .locator("#detail-content summary")
      .filter({ hasText: "记下首次尝试" })
      .click();
    await p.getByRole("button", { name: "保存日期" }).click();
    await p.getByRole("button", { name: "关闭卡片" }).click();
    assert.ok(p.url().includes("#growth/play"));
    await p.locator("#growth-back").click();
    await p.locator('a[href="#growth/diary"].tool-tile').click();
    await p.waitForFunction(
      () => document.querySelector("[data-week]")?.children.length === 7,
    );
    await openDiarySection(p, "编辑日记");
    await p.locator("[data-note]").fill("和奶奶一起翻布书");
    await p
      .locator("[data-images]")
      .setInputFiles(path.join(root, "assets", "icon-192.png"));
    await openDiarySection(p, "封面相册");
    await p.locator(".diary-thumbs img").waitFor();
    await p.locator('[data-diary-style="journal"]').click();
    await p.getByRole("button", { name: "保存日记" }).click();
    await p.getByText("已保存到本机", { exact: true }).waitFor();
    await p.getByRole("button", { name: "分享日签" }).click();
    await p.locator("dialog[open] .share-poster").waitFor();
    const [poster] = await Promise.all([
      p.waitForEvent("download"),
      p.getByRole("button", { name: "保存图片" }).click(),
    ]);
    assert.ok(poster.suggestedFilename().endsWith(".png"));
    await p.getByRole("button", { name: "关闭", exact: true }).click();
    await p.locator("#growth-back").click();
    await p.locator('a[href="#growth/report"].tool-tile').click();
    await p.locator(".report-note textarea").fill("想问儿保医生的问题");
    assert.match(
      await p.locator(".report-preview").innerText(),
      /测试麦穗[\s\S]+首次尝试记录[\s\S]+想问儿保医生的问题/,
    );
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await p.locator("#tools-button").click();
    const [download] = await Promise.all([
      p.waitForEvent("download"),
      p.locator("#export").click(),
    ]);
    const bytes = await fs.readFile(await download.path()),
      data = JSON.parse(bytes);
    assert.ok(data.diary[0].photos[0].startsWith("data:image/jpeg;base64,"));
    assert.equal(
      data.growth.find((r) => r.type === "profile").fields.name,
      "测试麦穗",
    );
    assert.ok(data.checkins.length);
    const ctx2 = await make(),
      p2 = await ctx2.newPage();
    await p2.goto(url + "#growth");
    await p2.locator(".tool-tile").first().waitFor();
    await p2.locator("#tools-button").click();
    const upload = (b) =>
      p2.locator("#import-file").setInputFiles({
        name: "测试备份.json",
        mimeType: "application/json",
        buffer: b,
      });
    const legacyId = "abc12345-1234-1234-1234-1234567890ab";
    await upload(
      Buffer.from(
        JSON.stringify({
          ...data,
          nativeUndatedTasks: [
            { id: legacyId, title: "旧版待办例子", completed: false },
          ],
        }),
      ),
    );
    await p2.getByText(/已合并.*1 篇日记/).waitFor();
    await upload(
      Buffer.from(
        JSON.stringify({
          ...data,
          growth: [
            {
              type: "measurement",
              id: "broken",
              updated: "2026-01-01",
              fields: { date: "bad" },
            },
          ],
        }),
      ),
    );
    await p2.getByText("成长资料备份格式有误。").waitFor();
    await p2.getByRole("button", { name: "关闭设置" }).click();
    await p2.locator('a[href="#growth/diary"].tool-tile').click();
    await openDiarySection(p2, "封面相册");
    await p2.locator(".diary-thumbs img").waitFor();
    assert.equal(
      await p2.locator("[data-note]").inputValue(),
      "和奶奶一起翻布书",
    );
    await p2.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await p2.waitForFunction(() => !!navigator.serviceWorker.controller);
    await ctx2.setOffline(true);
    await p2.reload();
    await openDiarySection(p2, "封面相册");
    await p2.locator(".diary-thumbs img").waitFor();
    await p2.locator("#growth-back").click();
    await p2.locator('a[href="#growth/measure"].tool-tile').click();
    await p2.locator(".health-chart").waitFor();
    await p2.goto(url + "#home");
    await p2.locator("#legacy-tasks summary").click();
    await p2.getByRole("checkbox", { name: "旧版待办例子" }).check();
    assert.equal(
      await p2.evaluate(
        (id) =>
          JSON.parse(localStorage.getItem("xiaomai/legacy-tasks/v1/" + id))
            .completed,
        legacyId,
      ),
      true,
    );
    await p2.locator("#tools-button").click();
    await p2.getByText("清空本机记录", { exact: true }).click();
    await p2.locator("#confirm-clear").check();
    p2.once("dialog", (d) => d.accept());
    await p2.locator("#clear-device").click();
    await p2.waitForFunction(
      () =>
        !Object.keys(localStorage).some(
          (k) => k.startsWith("xiaomai/") && k !== "xiaomai/stage",
        ),
    );
    await p2.goto(url + "#growth/diary");
    await p2.getByText(/已写 0 篇/).waitFor();
    const sources = JSON.parse(await fs.readFile(path.join(root, "cards.json"), "utf8"));
    const toddler = sources.cards.find((c) => c.activity?.window[0] >= 12 &&
      c.activity.window[0] <= 15 && c.activity.window[1] > 15);
    assert.ok(toddler, "需要覆盖满15个月的家庭活动");
    await p.goto(url + "?open=knowledge");
    await p.locator("#search").fill("15个月");
    const target = p.locator('#results a[href="#card/' + toddler.id + '"]');
    await target.click();
    for (const text of ["为什么做", "在家怎么做", "要观察什么"]) {
      await p.getByRole("heading", { name: text, exact: true }).waitFor();
    }
    await p.locator("#entry summary").click();
    await p.locator("#experience").fill("爷爷等她自己试了一次");
    await p.reload();
    assert.equal(await p.locator("#experience").inputValue(), "爷爷等她自己试了一次");
    await p.getByRole("button", { name: "关闭卡片" }).click();
    await p.goto(url + "#growth/play?month=15");
    await p.locator('.play-entry a[href="#card/' + toddler.id + '"]').waitFor();
    await p.goto(url + "?open=timeline");
    const stage = sources.stages.find((x) => x.window[0] <= 15 && 15 < x.window[1]);
    await p.locator("#stage-" + stage.id).click();
    assert.equal(await p.locator("#all-stage").getAttribute("href"), "#index?stage=" + stage.id);
    await p.goto(url + "?open=journal");
    await p.getByRole("link", {name: "知识库", exact: true}).filter({visible: true}).first().click();
    await p.locator("#search").fill("袜子");
    await p.locator('#results a[href="#card/edu-sock-pairs"]').click();
    await p.locator("#entry summary").click();
    await p.locator("#experience").fill("爸爸和小麦一起把袜子放进抽屉");
    await p.getByRole("button", {name:"关闭卡片"}).click();
    assert.match(p.url(), /#journal\/index/);
    await p.goto(url + "#journal/notes");
    await p.locator("#notes-list").getByText("爸爸和小麦一起把袜子放进抽屉").waitFor();
    await p.goto(url + "#journal/time/t18");
    await p.locator('#stage-t18[aria-current="step"]').waitFor();
    assert.equal(await p.locator("#checkin").isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS 家庭设置、今日游戏、首次尝试、照片与日签、报告、备份还原、离线成长曲线。",
    );
  } finally {
    await browser?.close();
    server.close();
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
