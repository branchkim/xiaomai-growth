import { localDay } from "./checkins.js";
import { lifeDay, monthsOld } from "./growth-store.js";
import {
  healthToday,
  plans,
  plot,
  visitStatus,
} from "./health.js";
import { metrics, observationGroups } from "./health-data.js";
import { growth } from "./health-growth.js";
import { canUndoRecentObservation, setObserved, setPlayed, setVisitActual } from "./monthly-checks.js";
import { gameCopy, familyObservations, monthTip, safetyGroups, monthMaterial } from "./month-entries.js";
import { includesMonth } from "./library.js";

const categories = [
  ["all", "全部"],
  ["plan", "疫苗体检"],
  ["develop", "发育观察"],
  ["play", "早教玩具"],
  ["alert", "警惕异常"],
];
const paths = {
  all: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  plan: '<path d="m6 15 8-8 4 4-8 8H6v-4Zm7-9 6 6m-3-8 4 4m-2-2-2 2M6 18l-3 3m7-9 2 2"/>',
  develop:
    '<path d="M4 18 17 5a1.8 1.8 0 0 1 2.5 0l1.4 1.4a1.8 1.8 0 0 1 0 2.5L8 22l-4-4Zm3.5-2.5 2 2m1-5 2 2m1-5 2 2"/>',
  play: '<path d="m12 2 4 6H8l4-6Zm-8 9h7v8H4z"/><circle cx="17.3" cy="16" r="4.3"/>',
  alert:
    '<path d="m10.4 4.6-8 13.7A1.8 1.8 0 0 0 4 21h16a1.8 1.8 0 0 0 1.6-2.7l-8-13.7a1.8 1.8 0 0 0-3.2 0Z"/><path d="M12 9v5m0 3h.01"/>',
  chart: '<path d="M3 4v16h18M6 15l5-5 3 2 6-7"/>',
  leaf: '<path d="M4 20c.5-4 2-6.5 5-9m0 0c-3 .3-5-1.8-5-5 3-.1 5.6 2 5 5Zm0 0c3-.4 6.2-4.6 5.4-8 4 1.2 6.3 4.2 5.2 7.7C18 16 12 17 8 15"/>',
  care: '<rect x="5" y="5.5" width="14" height="16" rx="3"/><path d="M10 5h4a1 1 0 0 0 0-2h-4a1 1 0 0 0 0 2Zm-1 9h6m-3-3v6"/>',
  arrow: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7 3v4m10-4v4M4 10h16m-11 4h2"/>',
  baby: '<path d="M4.2 11.3a7.9 7.9 0 0 1 15.6 0c2.7.5 2.6 4.5-.2 4.7a8.2 8.2 0 0 1-15.2 0c-2.8-.2-2.9-4.2-.2-4.7Z"/><path d="M12 3c.7 2 2.4 3.8.8 5.4m-5.3 4.3h.01m9 0h.01m-6 3.3c.9 1.2 2.4 1.3 3.5 0"/>',
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.7",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  }))
    svg.setAttribute(key, value);
  svg.innerHTML = paths[name];
  return svg;
}
function node(tag, cls, ...items) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.append(...items.filter((x) => x != null));
  return n;
}
function badge(kind, name = kind) {
  return node("span", "dash-icon " + kind, icon(name));
}
function link(label, href, cls) {
  const a = node("a", cls, label);
  a.href = href;
  return a;
}
function button(label, fn, cls) {
  const b = node("button", cls, label);
  b.type = "button";
  b.onclick = fn;
  return b;
}
function heading(iconName, text, tail) {
  const head = node(
    "header",
    "dash-head",
    node("h2", "", icon(iconName), text),
  );
  if (tail) head.append(tail);
  return head;
}
const monthName = (n) => (n === 0 ? "新生儿" : n + " 月龄");
const visitHref = (p) => "#growth/plan?visit=" + encodeURIComponent(p.id);
const cardHref = (c) => "#card/" + encodeURIComponent(c.id);
const groupHref = (m, id) =>
  "#growth/observe?month=" + m + (id ? "&mark=" + encodeURIComponent(id) : "");
function gamesFor(ctx, m) {
  return ctx.cards.filter((c) => includesMonth(c.activity?.window, m));
}

export function dashboardItems(ctx, month, day = localDay()) {
  const items = plans(ctx).filter(p => p.month === month).map(p => ({
    kind: "plan", id: p.id, title: p.title, visit: p, note: visitStatus(p),
    href: visitHref(p), action: p.actual ? "已记录" : "记日期", date: p.actual,
  }));
  const group = observationGroups.find(g => g.month === month);
  const marks = new Map(ctx.store.list("milestone").map(r => [r.id, r]));
  const observations = group ? group.marks.map(([key, title]) => {
    const id = "mark-" + month + "-" + key;
    return { id, title, how: "在日常互动中自然看到时记下。", href: groupHref(month, id) };
  }) : familyObservations(month, ctx.cards).map(o => ({
    ...o, href: o.cardId ? cardHref({id: o.cardId}) : null,
  }));
  for (const o of observations) {
    const record = marks.get(o.id);
    items.push({ ...o, kind: "develop", note: o.how, date: record?.date || "",
      action: record?.date ? "已做到" : "做到了" });
  }
  const played = new Set(ctx.store.list("activity").filter(r => r.date === day).map(r => r.id));
  for (const c of gamesFor(ctx, month)) {
    const copy = gameCopy[c.id], done = played.has("day-" + day + "-" + c.id);
    items.push({kind: "play", id: c.id, title: copy?.title || c.activity.title || c.title,
      note: copy?.how || c.activity.steps[0], href: cardHref(c), done, action: done ? "已玩过" : "今天玩过"});
  }
  return items;
}

export function visitTiming(p, day) {
  const value = p?.appointment || p?.target;
  if (!value) return "";
  const distance = Math.round(
    (Date.parse(value + "T00:00:00Z") - Date.parse(day + "T00:00:00Z")) /
      86400000,
  );
  const booked = Boolean(p.appointment);
  if (distance > 0)
    return (booked ? "距预约" : "距参考日") + " " + distance + " 天";
  if (distance === 0) return booked ? "今天已预约" : "今天到参考月龄";
  return booked
    ? "预约 " + value.slice(5).replace("-", "/") + " · 待核对"
    : "已到参考月龄 · 待核对";
}

function focusPanel(ctx, month, refresh, state) {
  const p = ctx.profile(),
    age = ctx.ageMonths(),
    day = localDay(),
    next = healthToday(ctx);
  const preview = age === null,
    m = preview ? month : age;
  const games = gamesFor(ctx, m);
  const game =
    next.activity ||
    (games.length
      ? (() => {
          const c = games[((lifeDay(p.birthday, day) || 1) - 1) % games.length];
          return { title: c.activity.title || c.title, cardId: c.id };
        })()
      : null);
  const focus = node(
    "section",
    "dash-card dash-focus",
    heading(
      "calendar",
      "今日关注",
      node(
        "time",
        "dash-date",
        String(Number(day.slice(5, 7))) + " 月 " + Number(day.slice(8)) + " 日",
      ),
    ),
  );
  function row(kind, label, title, destination, action) {
    const copy = destination ? link("", destination, "dash-focus-copy") : node("span", "dash-focus-copy");
    copy.append(node("small", "", label), node("strong", "", title));
    focus.append(node("div", "dash-focus-row", badge(kind), copy, action));
  }
  const browse = (text, href) => link(text, href, "dash-pill");
  if (p.reminders.plan) {
    const v = next.plan?.visitId
      ? plans(ctx).find((x) => x.id === next.plan.visitId)
      : null;
    const example = preview && plans(ctx).find((x) => x.month === m);
    const selected = v || example,
      href = selected ? visitHref(selected) : "#growth/plan";
    row(
      "plan",
      v
        ? visitTiming(v, day) || "近期安排"
        : preview
          ? "月龄安排参考"
          : "近期安排",
      selected?.title || "查看接种与儿保安排",
      href,
      browse(selected?.appointment ? "查预约" : "看安排", href),
    );
  }
  if (p.reminders.observation && m >= 0 && m < ctx.monthOptions.length) {
    const candidates = dashboardItems(ctx, m, day).filter(item => item.kind === "develop");
    const prior = state.focusObservation;
    const item = (prior?.month === m && prior.day === day && candidates.find(x => x.id === prior.id))
      || candidates.find(x => !x.date) || candidates[0];
    if (item) {
      state.focusObservation = {month:m, day, id:item.id};
      const key = "develop/" + item.id;
      const action = button(item.action, () => {
        try {
          if (item.date && !canUndoRecentObservation(state.justRecorded, key, item.date) &&
              !globalThis.confirm("撤销「" + item.title + "」在 " + item.date + " 的首次记录？原有备注会保留。")) return;
          setObserved(ctx.store, item, !item.date, item.date, day);
          if (item.date) state.justRecorded.delete(key); else state.justRecorded.set(key, localDay());
          refresh("observation");
          ctx.notify(item.date ? "已撤销这次打卡。" : "已记下首次做到的日期。");
        } catch (err) { ctx.notify(err.message); }
      }, "dash-pill dash-mark");
      action.dataset.focusAction = "observation";
      action.setAttribute("aria-pressed", String(!!item.date));
      row("develop", item.date ? "首次做到 · " + item.date : "日常观察", item.title, item.href, action);
    }
  }
  if (p.reminders.activity && game) {
    const href = "#card/" + encodeURIComponent(game.cardId);
    const key = "day-" + day + "-" + game.cardId;
    const done = ctx.store.list("activity").some((r) => r.id === key);
    const action = button(
      done ? "已完成" : "完成",
      () => {
        try {
          setPlayed(ctx.store, game.cardId, game.title, !done, day);
          refresh("activity");
          ctx.notify(done ? "已撤销此次完成记录。" : "今日游戏已完成。");
        } catch (err) {
          ctx.notify(err.message);
        }
      },
      "dash-pill dash-check",
    );
    action.dataset.focusAction = "activity";
    action.setAttribute("aria-pressed", String(done));
    row("play", "今日游戏", gameCopy[game.cardId]?.title || game.title, href, action);
  } else if (
    p.reminders.activity &&
    age !== null &&
    age >= ctx.monthOptions.length
  ) {
    const last = ctx.monthOptions.length - 1,
      href = "#growth/play?month=" + last;
    row(
      "play",
      "亲子游戏",
      "回看未满 " + ctx.monthOptions.length + " 个月的玩法",
      href,
      browse("看玩法", href),
    );
  }
  if (focus.children.length === 1)
    focus.append(
      link("设置今天想关注的事项 ›", "#growth/profile", "dash-empty"),
    );
  return focus;
}

function measurementPanel(ctx, state, onReferenceChange) {
  const section = node("section", "dash-card dash-curve");
  const add = link("记录测量", "#growth/measure?entry=new", "dash-add");
  add.prepend(icon("plus"));
  const measurements = ctx.store
    .list("measurement")
    .sort((a, b) => b.date.localeCompare(a.date));
  const indicators = node("div", "dash-metrics"),
    graphic = node("div", "dash-graphic");
  const draw = () => {
    for (const b of indicators.children)
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.dashMetric === state.metric),
      );
    const sex = ctx.profile().sex || state.reference;
    const reference = node("div", "dash-reference");
    if (!ctx.profile().sex) {
      const choose = node("select");
      choose.setAttribute("aria-label", "预览参考曲线人群");
      choose.add(new Option("女童参考", "female"));
      choose.add(new Option("男童参考", "male"));
      choose.value = sex;
      choose.onchange = () => {
        state.reference = choose.value;
        draw();
        onReferenceChange();
        graphic.querySelector("select")?.focus({ preventScroll: true });
      };
      reference.append(choose);
    } else
      reference.append(
        node("span", "", sex === "male" ? "男童参考" : "女童参考"),
      );
    reference.append(node("span", "", "出生至满周岁 · WS/T 423—2022"));
    // Without a selected reference in the profile the chart previews the standard only.
    const records = ctx.profile().sex ? measurements : [];
    graphic.replaceChildren(
      reference,
      plot(ctx, state.metric, sex, records, false, true),
    );
    if (
      measurements.some((r) => r[state.metric] > 0) &&
      (!ctx.profile().birthday || !ctx.profile().sex)
    )
      graphic.append(
        link(
          "补全档案，在图中查看宝宝的测量 ›",
          "#growth/profile",
          "dash-chart-link",
        ),
      );
  };
  for (const [key, m] of Object.entries(metrics)) {
    const r = measurements.find((r) => Number(r[key]) > 0),
      b = button(
        "",
        () => {
          state.metric = key;
          draw();
        },
        "dash-measure",
      );
    b.dataset.dashMetric = key;
    b.setAttribute("aria-label", "查看" + m.title + "曲线");
    b.append(
      node("small", "", m.title),
      node("strong", "", r ? String(r[key]) : "—", node("em", "", m.unit)),
      node(
        "span",
        "",
        r ? r.date.slice(5).replace("-", "/") + " 测量" : "尚未测量",
      ),
    );
    indicators.append(b);
  }
  section.append(heading("chart", "生长曲线", add), indicators, graphic);
  draw();
  return section;
}

function rangePanel(ctx, state, selectReference) {
  const month = state.month;
  if (month > 12) return null;
  const profile = ctx.profile(), sex = profile.sex || state.reference;
  const entries = ctx.store.list("measurement")
    .filter(r => monthsOld(profile.birthday, r.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date));
  const block = node("div", "dash-ranges");
  const caption = node("div", "dash-range-title", node("strong", "", (month ? "满 " + month + " 个月" : "出生时") + "的参考范围"));
  if (profile.sex) caption.append(node("span", "", sex === "male" ? "男童" : "女童"));
  else {
    const choose = node("select");
    choose.setAttribute("aria-label", "月龄参考范围人群");
    choose.add(new Option("女童参考", "female")); choose.add(new Option("男童参考", "male"));
    choose.value = sex;
    choose.onchange = () => selectReference(choose.value);
    caption.append(choose);
  }
  block.append(caption);
  for (const [key, metric] of Object.entries(metrics)) {
    const row = growth[sex][key][month];
    const [low,,, median,,, high] = row;
    const data = entries.find(r => r[key] > 0);
    const scale = v => 100 * (v - low) / (high - low);
    const bar = node("div", "dash-band");
    const center = node("i", "dash-band-mid");
    center.style.left = scale(median) + "%";
    bar.style.setProperty("--from", scale(row[2]) + "%");
    bar.style.setProperty("--to", scale(row[4]) + "%");
    bar.setAttribute("aria-hidden", "true");
    bar.append(center);
    block.append(node("div", "dash-range-row",
      node("div", "dash-range-values", node("strong", "", metric.title + "　" + low + "–" + high + " " + metric.unit),
        node("small", "", "中位 " + median)),
      bar, data ? node("small", "dash-range-own", "本月实测 · " + data.date + " · " + data[key] + " " + metric.unit) : null));
  }
  block.append(node("div", "dash-range-foot", node("span", "", "P3–P97 · WS/T 423—2022"),
    link(entries.length ? "补记本月测量" : "本月暂无测量 · 添加", "#growth/measure?entry=new")));
  return block;
}

function safetyPanel(month) {
  const box = node("section", "dash-warnings");
  for (const group of safetyGroups(month)) {
    const groupBox = node("div", "dash-warning " + group.level,
      node("h3", "", icon(group.level === "urgent" ? "alert" : group.level === "consult" ? "care" : "leaf"), group.title));
    const list = node("ul");
    for (const item of group.items)
      list.append(node("li", "", node("strong", "", item.title), node("span", "", item.how)));
    const clinic = group.level === "consult" && observationGroups.find(g => g.month === month);
    if (clinic) {
      for (const flag of clinic.flags) list.append(node("li", "", node("strong", "", flag)));
      groupBox.append(link("查看本月龄发育观察 ›", groupHref(month), "dash-source"));
    }
    groupBox.append(list);
    if (group.source?.url) {
      const source = link(group.source.title, group.source.url, "dash-source");
      source.target = "_blank"; source.rel = "noopener noreferrer";
      groupBox.append(source);
    }
    box.append(groupBox);
  }
  return box;
}

function visitForm(ctx, item, draft, save, close) {
  const vaccine = ["vaccine", "optional"].includes(item.visit.kind);
  const input = node("input");
  input.type = "date"; input.required = true; input.max = localDay();
  if (ctx.profile().birthday) input.min = ctx.profile().birthday;
  input.value = draft.date;
  input.oninput = () => { draft.date = input.value; };
  const label = node("label", "", vaccine ? "接种证上的实种日期" : "实际完成日期", input);
  const submit = node("button", "month-save", "保存日期"); submit.type = "submit";
  const actions = node("div", "month-form-actions", submit, button("收起", close));
  const form = node("form", "month-visit-form", label, actions);
  form.onsubmit = e => {
    e.preventDefault();
    if (input.reportValidity()) save(input.value);
  };
  if (item.date) actions.append(button("撤销记录", () => {
    if (globalThis.confirm("撤销「" + item.title + "」的实际日期？预约和备注会保留。")) save("");
  }));
  return form;
}

export function mountGrowthDashboard(outlet, ctx, state, query = "") {
  const params = new URLSearchParams(query);
  const age = ctx.ageMonths(),
    max = ctx.monthOptions.length - 1;
  const raw = params.get("month");
  if (raw !== null && /^\d+$/.test(raw) && +raw <= max) {
    state.month = +raw;
    state.manual = true;
  } else if (!state.manual) state.month = Math.min(age ?? 0, max);
  state.category = categories.some(([k]) => k === params.get("category"))
    ? params.get("category")
    : state.category || "all";
  state.justRecorded ||= new Map();
  state.metric ||= "weight";
  state.reference ||= "female";
  const dashboard = node("div", "growth-dashboard");
  const p = ctx.profile(),
    tag =
      age === null
        ? "填写生日"
        : age === 0
          ? "出生第 " + lifeDay(p.birthday, localDay()) + " 天"
          : monthName(age);
  const profile = link("", "#growth/profile", "dash-profile");
  profile.append(
    node("strong", "", p.name),
    node("i", "", "·"),
    tag,
    icon("arrow"),
  );
  const care = link("照护记录", "#checkin", "dash-care");
  care.prepend(icon("care"));
  if (window.xiaomaiNative?.openSection)
    care.onclick = (event) => {
      event.preventDefault();
      Promise.resolve(
        window.xiaomaiNative.openSection({ hash: "checkin" }),
      ).catch(() => {
        location.hash = "checkin";
      });
    };
  const top = node(
    "header",
    "dash-mast",
    node("span", "dash-baby", icon("baby")),
    node("div", "dash-identity", node("h1", "", "成长"), profile),
    care,
  );
  top.querySelector("h1").id = "dashboard-title";
  let focus;
  function focusDraw() {
    const next = focusPanel(ctx, state.month, (key) => { ctx.refresh(); outlet.querySelector('[data-focus-action="' + key + '"]')?.focus({preventScroll:true}); }, state);
    if (focus) focus.replaceWith(next);
    focus = next;
  }
  focusDraw();
  const catRail = node("div", "dash-categories"),
    monthRail = node("div", "dash-months");
  catRail.setAttribute("role", "group");
  catRail.setAttribute("aria-label", "成长类别");
  monthRail.setAttribute("role", "group");
  monthRail.setAttribute("aria-label", "选择月龄");
  const monthHead = node("header", "dash-month-head");
  const items = node("div", "dash-items");

  function dashboardRoute() {
    const values = new URLSearchParams();
    if (state.manual) values.set("month", String(state.month));
    if (state.manual || state.category !== "all")
      values.set("category", state.category);
    return "#growth/dashboard" + (values.size ? "?" + values.toString() : "");
  }
  function saveFilters() {
    state.route = dashboardRoute();
    if (
      location.hash.startsWith("#growth/dashboard") ||
      !location.hash ||
      location.hash === "#home"
    )
      history.replaceState(history.state, "", state.route);
  }
  function selectReference(sex) {
    state.reference = sex;
    ctx.refresh();
    outlet.querySelector('.dash-ranges select')?.focus({preventScroll:true});
  }
  function renderItem(item) {
    const key = item.kind + "/" + item.id;
    const row = node("div", "month-item");
    const line = node("div", "month-line");
    const text = item.href ? link("", item.href, "dash-row-copy") : node("span", "dash-row-copy");
    text.append(node("strong", "", item.title), node("small", "", item.note));
    if (item.kind === "develop" && item.date)
      text.append(node("small", "month-date", "首次做到 · " + item.date));
    const checked = item.kind === "play" ? item.done : !!item.date;
    const toggle = button(item.action, () => handle(), "month-check");
    toggle.dataset.dashCheck = key;
    if (item.kind === "plan") toggle.setAttribute("aria-expanded", String(state.visitDraft?.key === key));
    else toggle.setAttribute("aria-pressed", String(checked));
    if (checked) toggle.classList.add("is-done");
    function refreshHere() {
      const position = toggle.getBoundingClientRect().top;
      ctx.refresh();
      const next = outlet.querySelector('[data-dash-check="' + CSS.escape(key) + '"]');
      if (next) {
        window.scrollBy(0, next.getBoundingClientRect().top - position);
        next.focus({preventScroll:true});
      }
    }
    function handle() {
      try {
        if (item.kind === "plan") {
          state.visitDraft = state.visitDraft?.key === key ? null : {key, date: item.date, oldDate: item.date};
          rows();
          const next = items.querySelector('[data-dash-check="' + CSS.escape(key) + '"]');
          if (state.visitDraft) next?.closest(".month-item").querySelector("input")?.focus({preventScroll:true});
          else next?.focus({preventScroll:true});
          return;
        }
        if (item.kind === "play") {
          setPlayed(ctx.store, item.id, item.title, !checked);
        } else {
          if (checked && !canUndoRecentObservation(state.justRecorded, key, item.date) &&
              !globalThis.confirm("撤销「" + item.title + "」在 " + item.date + " 的首次记录？原有备注会保留。")) return;
          setObserved(ctx.store, item, !checked, item.date);
        }
        if (checked) state.justRecorded.delete(key);
        else state.justRecorded.set(key, localDay());
        refreshHere();
        ctx.notify(checked ? "已撤销这次打卡。" : item.kind === "play" ? "已记下今天玩过的游戏。" : "已保存首次做到的日期。");
      } catch (err) { ctx.notify(err.message); }
    }
    line.append(text, toggle);
    row.append(line);
    const draft = state.visitDraft;
    if (item.kind === "plan" && draft?.key === key) {
      row.append(visitForm(ctx, item, draft, (value) => {
        try {
          setVisitActual(ctx, item.id, value, draft.oldDate);
          state.visitDraft = null;
          refreshHere();
          ctx.notify(value ? "已保存实际日期。" : "已撤销实际日期。");
        } catch (err) { ctx.notify(err.message); }
      }, handle));
    }
    return row;
  }
  function rows() {
    for (const b of catRail.children)
      b.setAttribute("aria-pressed", String(b.dataset.dashCategory === state.category));
    for (const b of monthRail.children)
      b.setAttribute("aria-pressed", String(+b.dataset.dashMonth === state.month));
    const month = state.month, title = month === 0 ? "新生儿" : month + " 月龄";
    const range = month === 0 ? "出生至未满月" : "满 " + month + " 至未满 " + (month + 1) + " 个月";
    monthHead.replaceChildren(node("div", "month-caption", node("h2", "", title), node("span", "", range),
      age === month ? node("b", "", "当前") : null), node("p", "", monthTip(month)));
    items.replaceChildren();
    const all = dashboardItems(ctx, month);
    for (const [kind, label] of categories.slice(1)) {
      if (state.category !== "all" && state.category !== kind) continue;
      if (kind === "alert") {
        items.append(safetyPanel(month));
        continue;
      }
      const group = node("section", "month-group month-" + kind);
      const list = all.filter(item => item.kind === kind);
      const heading = kind === "develop" && !observationGroups.some(g => g.month === month) ? "生活观察" : label;
      group.append(node("h3", "", badge(kind), heading));
      if (kind === "develop") {
        const ranges = rangePanel(ctx, state, selectReference);
        if (ranges) group.append(ranges);
      }
      for (const item of list) group.append(renderItem(item));
      if (kind === "plan") {
        if (!list.length) group.append(node("p", "month-empty", month > 12
          ? "当前接种与儿保日程只收录至满周岁，之后请对照接种证及儿保手册。"
          : "本月没有收录固定项目，可按门诊安排添加。"));
        if (month <= 12) group.append(link("＋ 添加自费疫苗或门诊安排", "#growth/plan?entry=custom&month=" + month, "dash-plan-add"));
      }
      if (kind === "play") {
        const supplies = [...new Set(list.map(item => gameCopy[item.id]?.material).filter(Boolean))];
        if (supplies.length) group.append(node("details", "month-supplies",
          node("summary", "", "游戏要用什么"), node("p", "", supplies.join("、"))));
        const material = monthMaterial(month);
        if (material) group.append(node("aside", "month-material",
          node("strong", "", "家里就有 · " + material.title), node("p", "", material.how),
          node("small", "", material.safety)));
      }
      items.append(group);
    }
    if (month < max) {
      const next = button("下个月 · " + (month + 1) + " 月龄　›", () => {
        monthRail.querySelector('[data-dash-month="' + (month + 1) + '"]').click();
        monthHead.scrollIntoView({block:"start"});
      }, "dash-next-month");
      items.append(next);
    }
  }
  for (const [key, label] of categories) {
    const b = button(
      "",
      () => {
        state.visitDraft = null;
        state.category = key;
        saveFilters();
        rows();
      },
      "dash-cat",
    );
    b.dataset.dashCategory = key;
    b.append(badge(key), node("span", "", label));
    catRail.append(b);
  }
  for (const [m] of ctx.monthOptions) {
    const b = button(
      m === "0" ? "新生儿" : m + " 月龄",
      () => {
        state.visitDraft = null;
        state.month = Number(m);
        state.manual = true;
        saveFilters();
        rows();
        if (age === null) focusDraw();
      },
      "dash-month",
    );
    b.dataset.dashMonth = m;
    monthRail.append(b);
  }
  const tools = link("全部工具", "#growth", "dash-tools");
  tools.append(icon("arrow"));
  const monthly = node(
    "section",
    "dash-monthly",
    heading("leaf", "月龄事项", tools),
    age !== null && age > max
      ? node(
          "small",
          "dash-empty",
          "当前收录出生至未满 " + (max + 1) + " 个月的事项，可选月龄回看。",
        )
      : null,
    node("div", "dash-sticky", catRail, monthRail),
    monthHead,
    items,
  );
  rows();
  const utilities = node("nav", "dash-utilities", link("照片日签", "#growth/diary"), link("照护统计", "#growth/stats"));
  utilities.setAttribute("aria-label", "日签与统计");
  utilities.children[0].prepend(icon("calendar")); utilities.children[1].prepend(icon("chart"));
  dashboard.append(top, focus, utilities, measurementPanel(ctx, state, rows), monthly);
  outlet.replaceChildren(dashboard);
  const current = monthRail.querySelector('[aria-pressed="true"]');
  if (current)
    monthRail.scrollLeft = Math.max(
      0,
      current.offsetLeft -
        monthRail.offsetLeft -
        (monthRail.clientWidth - current.offsetWidth) / 2,
    );
  state.route = dashboardRoute();
}
