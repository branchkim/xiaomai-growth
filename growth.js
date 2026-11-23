import {
  GrowthStore,
  profileDefaults,
  monthsOld,
  validDay,
  lifeDay,
  saveFile,
} from "./growth-store.js";
import { localDay } from "./checkins.js";
import { mountHealth, healthReport, healthToday } from "./health.js";
import { mountCareTrends, careReport } from "./care-trends.js";
import { mountDiary } from "./diary.js";

const $ = (id) => document.getElementById(id);
const make = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const tabs = [
  ["stats", "照护统计", "近 7 天与 30 天"],
  ["measure", "生长曲线", "体重、身长、头围"],
  ["plan", "疫苗与儿保", "计划、预约、实种"],
  ["observe", "发育与早教", "里程碑与异常提示"],
  ["play", "亲子游戏", "按月龄选玩法与材料"],
  ["diary", "照片日记", "今日照片与日签"],
  ["report", "就诊报告", "选时段，带去儿保"],
  ["profile", "家庭设置", "宝宝档案、喂养与提醒"],
];
function link(label, hash, cls) {
  const a = make("a", label, cls);
  a.href = hash;
  return a;
}
function profileView(root, ctx) {
  const p = ctx.profile();
  root.innerHTML =
    '<div class="tool-heading"><h2>宝宝与家人</h2></div><form id="family-form" class="growth-form"><div class="field-grid"><label>宝宝昵称<input name="name" maxlength="40" required></label><label>出生日期<input type="date" name="birthday"></label><label>生长曲线参照<select name="sex"><option value="">先不选择</option><option value="female">女童</option><option value="male">男童</option></select></label><label>常用喂养方式<select name="feeding"><option value="">每次选择</option><option value="breast">亲喂</option><option value="bottle">瓶喂</option><option value="mixed">混合喂养</option></select></label><label>常用瓶内奶源<select name="milkSource"><option value="">每次选择</option><option value="formula">配方奶</option><option value="expressed">挤出的母乳</option></select></label><label>常用瓶喂量（mL，可选）<input name="amount" type="number" min="1" max="2000" step="1" inputmode="numeric"></label><label>家庭成员<input name="members" placeholder="爸爸、妈妈、奶奶，用顿号分开" maxlength="160"></label><label>本机记录人<select name="caregiver"></select></label><label>预约提前提醒<select name="leadDays"><option value="0">当天</option><option value="1">提前 1 天</option><option value="3">提前 3 天</option><option value="7">提前 7 天</option></select></label></div><fieldset class="inline-checks"><legend>首页显示</legend><label><input type="checkbox" name="plan">接种与儿保</label><label><input type="checkbox" name="observation">本周观察</label><label><input type="checkbox" name="activity">今日游戏</label></fieldset><div><button class="solid" type="submit">保存家庭设置</button></div></form><details class="growth-fold"><summary>隐私、备份与设备</summary><p>完整记录和照片保存在当前设备。家人只有在你主动分享时才会收到摘要或日签。换设备前可以导出备份。</p><div class="growth-actions"><button type="button" data-backup>安装与备份</button><a href="#growth/diary">管理照片</a></div></details>';
  const form = root.querySelector("form"),
    f = form.elements;
  for (const key of [
    "name",
    "birthday",
    "sex",
    "feeding",
    "amount",
    "leadDays",
  ])
    f[key].value = p[key];
  f.milkSource.value = p.milkSource || "";
  f.birthday.max = localDay();
  f.members.value = p.members.join("、");
  const members = () => [
    ...new Set(
      f.members.value
        .split(/[，,、\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const choose = (who) => {
    f.caregiver.replaceChildren(
      new Option("不署名", ""),
      ...members().map((m) => new Option(m, m)),
    );
    f.caregiver.value = who;
  };
  choose(p.caregiver);
  f.members.oninput = () => choose(f.caregiver.value);
  for (const k of ["plan", "observation", "activity"])
    f[k].checked = p.reminders[k];
  form.onsubmit = (e) => {
    e.preventDefault();
    const day = f.birthday.value;
    if (!f.name.value.trim() || (day && (!validDay(day) || day > localDay()))) {
      ctx.notify("请检查昵称和出生日期。");
      return;
    }
    try {
      ctx.store.put("profile", "baby", {
        name: f.name.value.trim(),
        birthday: day,
        sex: f.sex.value,
        feeding: f.feeding.value,
        milkSource: f.milkSource.value,
        amount: f.amount.value ? Number(f.amount.value) : "",
        members: members(),
        caregiver: f.caregiver.value,
        leadDays: Number(f.leadDays.value),
        reminders: Object.fromEntries(
          ["plan", "observation", "activity"].map((k) => [k, f[k].checked]),
        ),
      });
      ctx.refresh();
      ctx.notify("家庭设置已保存到本机。");
    } catch (e) {
      ctx.notify(e.message);
    }
  };
  const widget = make("details", null, "growth-fold");
  widget.append(
    make("summary", "主屏幕与锁屏"),
    make(
      "p",
      window.xiaomaiNative
        ? "在 iPhone 主屏幕长按空白处，点编辑并添加「小麦待办」。在锁屏长按并自定，可添加同名矩形组件。"
        : "家庭网页可添加到主屏幕。iPhone 原生版还可在主屏幕和锁屏添加「小麦待办」组件。",
    ),
  );
  root.append(widget);
  root.querySelector("[data-backup]").onclick = () => $("tools-button").click();
}

function playView(root, ctx) {
  const age = ctx.healthMonth ?? ctx.ageMonths() ?? 0;
  const h = make("div", null, "tool-heading"),
    label = make("label", "查看月龄 "),
    select = make("select");
  h.append(make("h2", "亲子游戏"), label);
  label.append(select);
  for (let i = 0; i <= 12; i++)
    select.add(
      new Option(
        i === 0 ? "未满 1 个月" : i === 12 ? "满周岁" : i + " 月龄",
        i,
      ),
    );
  select.value = Math.min(12, age);
  const list = make("div", null, "play-list");
  root.append(h, list);
  const draw = () => {
    list.replaceChildren();
    const m = Math.min(11, Number(select.value));
    if (Number(select.value) === 12)
      list.append(
        make(
          "p",
          "满周岁可以重玩这些熟悉的游戏，跟着孩子当下的兴趣调整。",
          "muted",
        ),
      );
    for (const card of ctx.cards.filter(
      (c) =>
        c.activity && m >= c.activity.window[0] && m < c.activity.window[1],
    )) {
      const a = card.activity,
        d = make("article", null, "play-entry"),
        title = link(a.title || card.title, "#card/" + card.id);
      d.append(
        title,
        make("p", "手边材料 · " + a.materials),
        make("small", "什么时候试 · " + a.signal),
      );
      if (ctx.store.list("activity").some((r) => r.id === "first-" + card.id))
        d.append(make("small", "家里已经试过"));
      list.append(d);
    }
    const diy = make("details", null, "growth-fold");
    diy.append(make("summary", "家里的材料怎么用"));
    const homeIdeas =
      m < 3
        ? [
            "自制黑白图卡",
            "在白纸上画一个粗黑圆或几道宽条纹。爸爸拿稳纸卡，宝宝愿意看时停一会儿，转开目光就收起。纸卡由大人保管。",
          ]
        : m < 6
          ? [
              "触感小游戏",
              "找一块洗净、没有松线的软布。你拿着一角，让宝宝主动用手摸一摸，不遮住口鼻，玩完把布收好。",
            ]
          : m < 9
            ? [
                "一只碗和一把勺",
                "拿出家里不易碎的碗和一体成型的大软勺。你轻轻敲一下，停下来轮到宝宝试，始终坐在旁边。",
              ]
            : [
                "用纸板书找一找",
                "挑一本边角圆、没有破损的硬纸板书，翻到宝宝喜欢的一页。跟着他的手指说出一样东西，等他回应。",
              ];
    diy.append(make("h3", homeIdeas[0]), make("p", homeIdeas[1]));
    list.append(diy);
  };
  select.onchange = draw;
  draw();
}

function reportView(root, ctx) {
  root.innerHTML =
    '<div class="tool-heading"><h2>就诊报告</h2><label>照护时段 <select data-days><option value="7">近 7 天</option><option value="30">近 30 天</option></select></label></div><fieldset class="inline-checks"><legend>带入报告</legend><label><input type="checkbox" checked value="care">照护统计</label><label><input type="checkbox" checked value="health">体测、接种与观察</label></fieldset><label class="report-note">想问医生的事（可留空）<textarea rows="2" maxlength="1500"></textarea></label><pre class="report-preview"></pre><div class="growth-actions"><button type="button" class="solid" data-save>导出报告</button><button type="button" data-copy>复制文字</button><button type="button" data-print>打印 / 存 PDF</button></div>';
  const preview = root.querySelector("pre");
  const build = () => {
    const profile = ctx.profile();
    const age = ctx.ageMonths(),
      days = Number(root.querySelector("select").value);
    const sections = [
      "儿童就诊记录 · " + profile.name,
      "整理日期 " +
        localDay() +
        (profile.birthday
          ? "　出生日期 " + profile.birthday + "（已满 " + age + " 个月）"
          : ""),
    ];
    if (root.querySelector('[value="care"]').checked)
      sections.push(careReport(ctx.checkins, days));
    if (root.querySelector('[value="health"]').checked) {
      sections.push(healthReport(ctx));
      const first = ctx.store
        .list("activity")
        .filter((x) => x.id.startsWith("first-"));
      if (first.length)
        sections.push(
          "首次尝试记录\n" +
            first.map((x) => x.date + "　" + x.title).join("\n"),
        );
    }
    const question = root.querySelector("textarea").value.trim();
    if (question) sections.push("想问医生的事\n" + question);
    sections.push("以上由家庭自行记录，空白时段表示没有记录。");
    preview.textContent = sections.filter(Boolean).join("\n\n");
  };
  root.oninput = build;
  build();
  root.querySelector("[data-save]").onclick = async () => {
    try {
      await ctx.saveFile(
        new Blob([preview.textContent], { type: "text/plain;charset=utf-8" }),
        "小麦就诊报告-" + localDay() + ".txt",
      );
      ctx.notify("已生成就诊报告。");
    } catch (e) {
      ctx.notify(e.message);
    }
  };
  root.querySelector("[data-copy]").onclick = async () => {
    try {
      await navigator.clipboard.writeText(preview.textContent);
      ctx.notify("报告已复制。");
    } catch {
      const r = document.createRange();
      r.selectNodeContents(preview);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      ctx.notify("已选中报告，可长按复制。");
    }
  };
  root.querySelector("[data-print]").onclick = () => {
    if (window.xiaomaiNative?.printText)
      window.xiaomaiNative.printText({ text: preview.textContent });
    else window.print();
  };
  if (window.xiaomaiNative && !window.xiaomaiNative.printText)
    root.querySelector("[data-print]").hidden = true;
}

export function setupGrowth({ storage, checkins, data }) {
  const store = new GrowthStore(storage),
    outlet = $("growth-content");
  let active = "",
    messageTimer;
  const notify = (message) => {
    const status = $("growth-notice");
    status.textContent = message;
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => {
      status.textContent = "";
    }, 6500);
  };
  const syncDefaults = () => {
    const p = store.profile();
    if (window.xiaomaiNative?.setDefaults)
      Promise.resolve(
        window.xiaomaiNative.setDefaults({
          caregiver: p.caregiver,
          feeding: p.feeding,
          amount: p.amount,
        }),
      ).catch(() => notify("本机资料已保存。原生打卡预填暂未更新。"));
  };
  const ctx = {
    store,
    checkins,
    cards: data.cards,
    profile: () => store.profile(),
    ageMonths: () => monthsOld(store.profile().birthday),
    refresh: () => {
      today();
      syncDefaults();
    },
    notify,
    saveFile,
    remind: window.xiaomaiNative?.remind
      ? (details) => window.xiaomaiNative.remind(details)
      : undefined,
    cancelReminder: window.xiaomaiNative?.cancelReminder
      ? (id) => window.xiaomaiNative.cancelReminder({ id })
      : undefined,
  };
  function today() {
    const p = ctx.profile(),
      area = $("today-focus");
    area.replaceChildren();
    if (!p.birthday) {
      area.append(
        make("h2", "今日关注"),
        link(
          "填写宝宝生日，看看今天玩什么 →",
          "#growth/profile",
          "today-profile",
        ),
      );
      return;
    }
    const head = make("div", null, "section-head");
    head.append(
      make("h2", "今日关注"),
      link(
        p.name + " · 出生第 " + lifeDay(p.birthday, localDay()) + " 天",
        "#growth/profile",
        "today-age",
      ),
    );
    area.append(head);
    const next = healthToday(ctx) || {},
      day = localDay();
    const add = (label, item, href, kind) => {
      if (!item) return;
      const row = make("div", null, "focus-row");
      row.append(make("span", label, "focus-type"));
      const text = link(item.title, href, "focus-title");
      if (item.detail) text.append(make("small", item.detail));
      row.append(text);
      if (kind === "activity") {
        const id = "day-" + day + "-" + (item.cardId || "game"),
          b = make("button", null, "focus-check");
        const marked = store.list("activity").some((r) => r.id === id);
        b.textContent = marked ? "已完成" : "完成";
        b.setAttribute("aria-pressed", String(marked));
        b.onclick = () => {
          try {
            if (marked) store.remove("activity", id);
            else
              store.put("activity", id, {
                date: day,
                title: item.title,
                cardId: item.cardId || "",
              });
            today();
          } catch (e) {
            notify(e.message);
          }
        };
        row.append(b);
      }
      if (kind === "observation" && item.milestoneId) {
        const b = make("button", "做到了", "focus-check");
        b.onclick = () => {
          try {
            const old = store
              .list("milestone")
              .find((x) => x.id === item.milestoneId);
            store.put("milestone", item.milestoneId, {
              date: day,
              note: old?.note || "",
            });
            today();
            notify("已记下首次日期，可在发育观察中修改。");
          } catch (e) {
            notify(e.message);
          }
        };
        row.append(b);
      }
      area.append(row);
    };
    if (p.reminders.plan)
      add(
        "近期安排",
        next.plan || { title: "查看儿保与接种计划" },
        next.plan?.visitId
          ? "#growth/plan?visit=" + encodeURIComponent(next.plan.visitId)
          : "#growth/plan",
        "plan",
      );
    if (p.reminders.observation)
      add(
        "本周观察",
        next.observation || { title: "记录一次新的发现" },
        "#growth/observe",
        "observation",
      );
    if (p.reminders.activity) {
      let item = next.activity;
      if (!item && ctx.ageMonths() <= 12) {
        const eligible = data.cards.filter(
          (c) =>
            c.activity &&
            ctx.ageMonths() >= c.activity.window[0] &&
            ctx.ageMonths() < c.activity.window[1],
        );
        const card = eligible.length
          ? eligible[(lifeDay(p.birthday, day) - 1) % eligible.length]
          : null;
        if (card)
          item = { title: card.activity.title || card.title, cardId: card.id };
      }
      if (item)
        add(
          "今日游戏",
          item,
          item.cardId ? "#card/" + item.cardId : "#growth/observe",
          "activity",
        );
    }
  }
  function render(raw = "", query = "") {
    const pane = raw === "health" ? "plan" : raw;
    active = pane;
    const selection = tabs.some(([key]) => key === pane);
    const list = $("growth-menu");
    list.hidden = selection;
    $("growth-back").hidden = !selection;
    outlet.hidden = !selection;
    $("growth-title").textContent = selection ? "成长手账" : "成长工具";
    if (!selection) {
      outlet.replaceChildren();
      list.querySelector(".month-guide")?.remove();
      list.append(monthGuide());
      return;
    }
    outlet.oninput = null;
    outlet.replaceChildren();
    ctx.healthSection = pane;
    const mo = new URLSearchParams(query).get("month");
    ctx.healthMonth =
      mo !== null && /^(?:[0-9]|1[012])$/.test(mo) ? Number(mo) : null;
    ctx.healthVisitId =
      pane === "plan" ? new URLSearchParams(query).get("visit") : null;
    if (pane === "play") playView(outlet, ctx);
    if (pane === "profile") profileView(outlet, ctx);
    if (pane === "diary") {
      const diary = make("div");
      outlet.append(diary);
      mountDiary(diary, ctx);
    }
    if (pane === "stats") mountCareTrends(outlet, ctx);
    if (pane === "report") reportView(outlet, ctx);
    if (["plan", "measure", "observe"].includes(pane)) mountHealth(outlet, ctx);
  }
  function monthGuide() {
    const box = make("section", null, "month-guide"),
      head = make("div", null, "tool-heading"),
      name = make("h2", "按月龄看"),
      select = make("select");
    select.setAttribute("aria-label", "成长工具月龄");
    head.append(name, select);
    for (let i = 0; i <= 12; i++)
      select.add(new Option(i === 0 ? "出生至满月" : i + " 月龄", i));
    select.value = Math.min(12, ctx.ageMonths() ?? 0);
    const links = make("div", null, "home-shortcuts");
    const update = () => {
      links.replaceChildren(
        ...[
          ["plan", "疫苗与儿保"],
          ["observe", "发育与提醒"],
          ["play", "游戏与材料"],
        ].map(([k, t]) => link(t, "#growth/" + k + "?month=" + select.value)),
      );
    };
    select.onchange = update;
    update();
    box.append(head, links);
    return box;
  }
  for (const [key, title, subtitle] of tabs) {
    const a = link("", "#growth/" + key, "tool-tile");
    a.append(make("strong", title), make("small", subtitle));
    $("growth-menu").append(a);
  }
  function cardPractice(card, root) {
    if (
      !card.activity &&
      !["亲子活动", "动作探索", "语言与互动"].includes(card.topic)
    )
      return;
    const id = "first-" + card.id,
      current = store.list("activity").find((x) => x.id === id);
    const fold = make("details", null, "fold"),
      summary = make(
        "summary",
        current ? "首次尝试 · " + current.date : "记下首次尝试",
      );
    const label = make("label", "首次尝试日期 "),
      field = make("input");
    field.type = "date";
    field.max = localDay();
    field.value = current?.date || localDay();
    label.append(field);
    const button = make("button", current ? "更新日期" : "保存日期", "tools");
    button.onclick = () => {
      if (!validDay(field.value) || field.value > localDay()) return;
      try {
        store.put("activity", id, {
          date: field.value,
          title: card.activity?.title || card.title,
          cardId: card.id,
        });
        summary.textContent = "首次尝试 · " + field.value;
        fold.open = false;
      } catch (e) {
        notify(e.message);
      }
    };
    fold.append(summary, label, button);
    root.append(fold);
  }
  function updateCare() {
    today();
    if (!$("growth").hidden && active === "stats") render(active);
  }
  window.addEventListener("xiaomai-care-change", updateCare);
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.startsWith("xiaomai/growth/v1/")) today();
  });
  function atMidnight() {
    const now = new Date(),
      next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    setTimeout(
      () => {
        today();
        atMidnight();
      },
      +next - +now + 500,
    );
  }
  atMidnight();
  window.addEventListener("pageshow", today);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) today();
  });
  today();
  syncDefaults();
  return {
    store,
    render,
    today,
    cardPractice,
    refresh: () => {
      ctx.refresh();
      if (active && !$("growth").hidden) render(active);
    },
    notify,
  };
}
