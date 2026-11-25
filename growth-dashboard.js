import { localDay } from "./checkins.js";
import { lifeDay } from "./growth-store.js";
import {
  healthToday,
  plans,
  plot,
  urgentSigns,
  visitStatus,
} from "./health.js";
import { metrics, observationGroups } from "./health-data.js";
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

export function dashboardItems(ctx, month) {
  const items = plans(ctx)
    .filter((p) => p.month === month)
    .map((p) => ({
      kind: "plan",
      title: p.title,
      note: visitStatus(p),
      href: visitHref(p),
      action: p.actual ? "已记录" : p.appointment ? "已预约" : "去记录",
    }));
  const group = observationGroups.find((g) => g.month === month);
  if (group) {
    const done = new Map(ctx.store.list("milestone").map((r) => [r.id, r]));
    for (const [key, title] of group.marks) {
      const id = "mark-" + month + "-" + key,
        record = done.get(id);
      items.push({
        kind: "develop",
        title: title,
        note: record?.date
          ? "首次做到 · " + record.date
          : "满 " + month + " 月龄时，在日常活动里观察",
        href: groupHref(month, id),
        action: record?.date || record?.note ? "已记录" : "记观察",
      });
    }
  }
  const games = gamesFor(ctx, month);
  if (!group) {
    const first = games.find((c) => c.activity.observe || c.observation);
    if (first)
      items.push({
        kind: "develop",
        title: first.activity.observe || first.observation,
        note: "家庭观察 · " + first.activity.scene,
        href: cardHref(first),
        action: "记经验",
      });
  }
  const tried = new Set(
    ctx.store
      .list("activity")
      .filter((r) => r.date)
      .map((r) => r.cardId),
  );
  for (const c of games)
    items.push({
      kind: "play",
      title: c.activity.title || c.title,
      note: c.activity.materials,
      href: cardHref(c),
      action: tried.has(c.id) ? "已玩过" : "看玩法",
    });
  if (group)
    items.push({
      kind: "alert",
      title: "满 " + month + " 月龄，哪些表现值得问医生？",
      note: group.flags[0],
      href: groupHref(month),
      action: "看提示",
    });
  else if (month === 0)
    items.push({
      kind: "alert",
      title: "新生儿有哪些情况要尽快就医？",
      note: "吃奶、清醒状态和呼吸的变化",
      href: groupHref(0),
      action: "看提示",
    });
  else
    items.push({
      kind: "alert",
      title: "遇到哪些情况要马上就医？",
      note: "各月龄适用的紧急信号",
      urgent: true,
    });
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

function focusPanel(ctx, month, refresh) {
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
    const copy = link("", destination, "dash-focus-copy");
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
  if (p.reminders.observation) {
    const obs = next.observation,
      id = obs?.milestoneId,
      groupMonth = id ? Number(id.split("-")[1]) : null;
    const card = games.find((c) => c.activity.observe || c.observation);
    const href = obs
      ? groupHref(groupMonth ?? 0, id)
      : card
        ? cardHref(card)
        : "#growth/diary";
    const action = id
      ? button(
          "做到了",
          () => {
            try {
              const saved = ctx.store
                .list("milestone")
                .find((r) => r.id === id);
              ctx.store.put("milestone", id, {
                date: saved?.date || day,
                note: saved?.note || "",
              });
              refresh("observation");
              ctx.notify("已记下首次做到的日期。");
            } catch (err) {
              ctx.notify(err.message);
            }
          },
          "dash-pill dash-mark",
        )
      : browse("去看看", href);
    if (id) action.dataset.focusAction = "observation";
    row(
      "develop",
      id ? "满 " + groupMonth + " 月龄观察" : "日常观察",
      obs?.title ||
        card?.activity?.observe ||
        card?.observation ||
        "记下今天宝宝的新发现",
      href,
      action,
    );
  }
  if (p.reminders.activity && game) {
    const href = "#card/" + encodeURIComponent(game.cardId);
    const key = "day-" + day + "-" + game.cardId;
    const done = ctx.store.list("activity").some((r) => r.id === key);
    const action = button(
      done ? "已完成" : "完成",
      () => {
        try {
          if (done) ctx.store.remove("activity", key);
          else
            ctx.store.put("activity", key, {
              date: day,
              title: game.title,
              cardId: game.cardId,
            });
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
    row("play", "今日游戏", game.title, href, action);
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

function measurementPanel(ctx, state) {
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
  function focusDraw(key) {
    const next = focusPanel(ctx, state.month, focusDraw);
    if (focus) focus.replaceWith(next);
    focus = next;
    if (key)
      focus
        .querySelector('[data-focus-action="' + key + '"]')
        ?.focus({ preventScroll: true });
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
  items.setAttribute("aria-live", "polite");
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
  function rows() {
    for (const b of catRail.children)
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.dashCategory === state.category),
      );
    for (const b of monthRail.children)
      b.setAttribute(
        "aria-pressed",
        String(+b.dataset.dashMonth === state.month),
      );
    const all = dashboardItems(ctx, state.month);
    const shown = all.filter(
      (x) => state.category === "all" || state.category === x.kind,
    );
    const headingText =
      state.month === 0 ? "新生儿月龄事项" : "满 " + state.month + " 个月";
    monthHead.replaceChildren(
      node("h2", "", node("span", "dash-timeline-dot"), headingText),
      node("span", "", shown.length + " 项"),
    );
    items.replaceChildren();
    for (const item of shown) {
      const name = node(
        "span",
        "dash-row-copy",
        node("strong", "", item.title),
        node("small", "", item.note),
      );
      if (item.urgent) {
        const fold = node("details", "dash-item dash-alert-fold"),
          summary = node(
            "summary",
            "",
            badge(item.kind),
            name,
            node("span", "dash-row-action", "看提示", icon("arrow")),
          );
        fold.append(summary, urgentSigns(state.month));
        items.append(fold);
      } else {
        const a = link("", item.href, "dash-item");
        a.append(
          badge(item.kind),
          name,
          node("span", "dash-row-action", item.action, icon("arrow")),
        );
        items.append(a);
      }
    }
    if (state.category === "plan" && state.month <= 12) {
      const add = link(
        "添加自费疫苗或门诊安排",
        "#growth/plan?entry=custom&month=" + state.month,
        "dash-plan-add",
      );
      add.prepend(icon("plus"));
      items.append(add);
    }
    if (!shown.length)
      items.append(
        node(
          "div",
          "dash-empty",
          node(
            "p",
            "",
            state.category === "plan"
              ? "这个月龄没有收录的固定接种或儿保项目。"
              : "这个月龄暂未收录该类事项。",
          ),
          link(
            state.category === "plan"
              ? "查看接种与儿保计划 ›"
              : "查看本月龄知识卡 ›",
            state.category === "plan"
              ? "#growth/plan"
              : "#index?age=" + state.month,
          ),
        ),
      );
  }
  for (const [key, label] of categories) {
    const b = button(
      "",
      () => {
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
    catRail,
    monthRail,
    monthHead,
    items,
  );
  rows();
  dashboard.append(top, focus, measurementPanel(ctx, state), monthly);
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
