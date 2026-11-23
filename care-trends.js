import { careDescription, careTime, localDay } from "./checkins.js";

const minute = 60000;
const metrics = {
  milk: { label: "瓶喂奶量", unit: "mL", color: "milk" },
  sleep: { label: "已记睡眠", unit: "分钟", color: "sleep" },
  stool: { label: "便便", unit: "次", color: "stool" },
};

function decimal(value) {
  return String(Math.round(value * 10) / 10);
}
function duration(minutes) {
  const rounded = Math.round(minutes);
  if (!rounded && minutes > 0) return "不足 1 分钟";
  const hours = Math.floor(rounded / 60),
    tail = rounded % 60;
  return hours
    ? hours + " 小时" + (tail ? " " + tail + " 分钟" : "")
    : tail + " 分钟";
}
function displayValue(metric, value) {
  if (value === null) return "未记录";
  return metric === "sleep"
    ? duration(value)
    : decimal(value) + " " + metrics[metric].unit;
}
function dateOnly(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}
function toList(store) {
  return Array.isArray(store) ? store : [...store.items.values()];
}

// Merge overlapping intervals from family backups before counting clock time.
function sleepMinutes(parts) {
  if (!parts.length) return null;
  let covered = 0,
    lastEnd = -Infinity;
  for (const [start, end] of parts.sort((a, b) => a[0] - b[0])) {
    covered += Math.max(0, end - Math.max(lastEnd, start));
    lastEnd = Math.max(lastEnd, end);
  }
  return covered / minute;
}

export function careStats(checkins, days = 7, now = new Date(), lastDay = now) {
  const count = days === 30 ? 30 : 7;
  const rows = Array.from({ length: count }, (_, i) => {
    const start = dateOnly(lastDay, i - count + 1);
    return {
      day: localDay(start),
      start: +start,
      end: +dateOnly(start, 1),
      observed: false,
      milk: null,
      sleep: null,
      stool: null,
      feeds: 0,
      sleeps: [],
      diapers: 0,
      unknownDiapers: 0,
    };
  });
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const records = [],
    feeds = [];
  const totals = {
    bottles: 0,
    measured: 0,
    breast: 0,
    unknownFeed: 0,
    unclassified: 0,
    running: 0,
    points: 0,
  };
  for (const item of toList(checkins)) {
    if (item.kind === "task") continue;
    const start = Date.parse(item.created);
    if (!Number.isFinite(start) || start > +now) continue;
    const row = byDay.get(localDay(new Date(start)));
    const end = item.sleepEnd && Date.parse(item.sleepEnd);
    const finished = item.kind === "sleep" && end > start && end <= +now;
    const crossesPeriod =
      finished && end > rows[0].start && start < rows.at(-1).end;
    const running = item.kind === "sleep" && item.sleepEnd === null;
    if (!row && !crossesPeriod && !running) continue;
    if (running) totals.running++;
    records.push(item);
    if (row) {
      row.observed = true;
      if (item.kind === "feed") {
        feeds.push({ time: start, day: row.start });
        row.feeds++;
        if (item.feedType === "bottle") {
          totals.bottles++;
          if (item.amountMl != null) {
            row.milk = (row.milk ?? 0) + item.amountMl;
            totals.measured++;
          }
        } else if (item.feedType === "breast") totals.breast++;
        else totals.unknownFeed++;
      } else if (item.kind === "diaper") {
        row.diapers++;
        if (item.diaperType) {
          row.stool = (row.stool ?? 0) + (item.diaperType === "wet" ? 0 : 1);
        } else {
          row.unknownDiapers++;
          totals.unclassified++;
        }
      } else if (!running && !finished) totals.points++;
    }
    if (finished) {
      for (const date of rows) {
        const left = Math.max(start, date.start),
          right = Math.min(end, date.end);
        if (right > left) {
          date.sleeps.push([left, right]);
          date.observed = true;
        }
      }
    }
  }
  for (const row of rows) {
    row.sleep = sleepMinutes(row.sleeps);
    if (row.stool === 0 && row.unknownDiapers) row.stool = null;
  }
  // Skip gaps that contain a whole calendar day without feeding timestamps.
  feeds.sort((a, b) => a.time - b.time);
  const intervals = [];
  for (let i = 1; i < feeds.length; i++) {
    const previous = feeds[i - 1],
      next = feeds[i];
    if (next.day <= +dateOnly(new Date(previous.day), 1))
      intervals.push((next.time - previous.time) / minute);
  }
  const stats = {};
  for (const key of Object.keys(metrics)) {
    const known = rows.map((row) => row[key]).filter((value) => value !== null);
    const sum = known.reduce((a, b) => a + b, 0);
    stats[key] = {
      days: known.length,
      total: known.length ? sum : null,
      average: known.length ? sum / known.length : null,
    };
  }
  const feedDays = rows.filter((row) => row.feeds).length;
  const meanInterval = intervals.length
    ? intervals.reduce((a, b) => a + b, 0) / intervals.length
    : null;
  records.sort(
    (a, b) =>
      Date.parse(b.created) - Date.parse(a.created) || a.id.localeCompare(b.id),
  );
  return {
    count,
    rows,
    totals,
    stats,
    feedCount: feeds.length,
    feedDays,
    meanInterval,
    intervalCount: intervals.length,
    observed: rows.filter((row) => row.observed).length,
    records,
  };
}

function compactDay(value) {
  return value.slice(5).replace("-", "/");
}
export function careReport(checkins, days = 7, now = new Date()) {
  const data = careStats(checkins, days, now),
    { rows, totals, stats } = data;
  const head =
    "近 " +
    data.count +
    " 天照护（" +
    rows[0].day +
    " 至 " +
    rows.at(-1).day +
    "），有记录 " +
    data.observed +
    " 天。";
  if (!data.observed)
    return (
      head +
      (totals.running
        ? "\n另有 " +
          totals.running +
          " 段时段开始前已入睡、尚未结束的记录，未计入时长。"
        : "\n此时段没有照护记录。")
    );
  const feeding = data.feedCount
    ? "喂养 " +
      data.feedCount +
      " 次，分布在 " +
      data.feedDays +
      " 天（亲喂 " +
      totals.breast +
      " 次、瓶喂 " +
      totals.bottles +
      " 次、方式未记 " +
      totals.unknownFeed +
      " 次）。"
    : "喂养次数未记录。";
  const milk = stats.milk.days
    ? "瓶喂已记 " +
      stats.milk.total +
      " mL。按有奶量的 " +
      stats.milk.days +
      " 天计算，日均 " +
      decimal(stats.milk.average) +
      " mL。"
    : "瓶喂奶量未记录。";
  const interval =
    data.meanInterval === null
      ? "喂养间隔数据不足。"
      : "相邻喂养平均间隔 " +
        duration(data.meanInterval) +
        "（" +
        data.intervalCount +
        " 段，跳过整天缺记）。";
  const sleep = stats.sleep.days
    ? "已结束睡眠合计 " +
      duration(stats.sleep.total) +
      "。按有睡眠时长的 " +
      stats.sleep.days +
      " 天计算，日均 " +
      duration(stats.sleep.average) +
      "。"
    : "已结束的睡眠时长未记录。";
  const stool = stats.stool.days
    ? "已确认便便 " +
      stats.stool.total +
      " 次。按可计数的 " +
      stats.stool.days +
      " 天计算，日均 " +
      decimal(stats.stool.average) +
      " 次。"
    : "便便次数未记录。";
  return [
    head,
    feeding + interval,
    milk +
      (totals.bottles > totals.measured
        ? "另有 " + (totals.bottles - totals.measured) + " 次瓶喂未记奶量。"
        : ""),
    sleep +
      (totals.running ? "进行中 " + totals.running + " 条。" : "") +
      (totals.points ? "仅记入睡 " + totals.points + " 条。" : ""),
    stool +
      (totals.unclassified
        ? "另有 " + totals.unclassified + " 条尿布未分类。"
        : ""),
  ].join("\n");
}

export function handoffText(name, items) {
  if (!items.length) return "";
  const lines = [...items]
    .sort(
      (a, b) =>
        Date.parse(a.created) - Date.parse(b.created) ||
        a.id.localeCompare(b.id),
    )
    .map((item) => careTime(item.created) + "  " + careDescription(item));
  return [(name || "宝宝") + "的照护交班", ...lines].join("\n");
}

function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function btn(text, cls) {
  const node = el("button", text, cls);
  node.type = "button";
  return node;
}
function chart(data, metric) {
  const meta = metrics[metric];
  const figure = el("figure", undefined, "care-chart " + meta.color);
  const top = el("figcaption");
  top.append(el("strong", meta.label), el("span", meta.unit));
  if (!data.stats[metric].days) top.append(el("small", "这段时间未记录"));
  const plot = el("div", undefined, "care-chart-plot");
  plot.setAttribute("aria-hidden", "true");
  const peak = data.rows.reduce(
    (max, row) => Math.max(max, row[metric] || 0),
    0,
  );
  const high = el(
    "span",
    data.stats[metric].days ? decimal(peak) : "—",
    "care-chart-high",
  );
  const bars = el("div", undefined, "care-bars");
  for (const row of data.rows) {
    const value = row[metric],
      bar = el("span", undefined, "care-bar");
    bar.title = row.day + " " + displayValue(metric, value);
    bar.classList.toggle("missing", value === null);
    bar.classList.toggle("zero", value === 0);
    if (value > 0) bar.style.height = Math.max(3, (100 * value) / peak) + "%";
    bars.append(bar);
  }
  plot.append(high, bars);
  const axis = el("div", undefined, "care-chart-axis");
  axis.append(
    el("span", compactDay(data.rows[0].day)),
    el("span", compactDay(data.rows.at(-1).day)),
  );
  figure.append(top, plot, axis);
  const stat = data.stats[metric];
  if (stat.days)
    figure.append(
      el(
        "small",
        "有记录的 " +
          stat.days +
          " 天，日均 " +
          displayValue(metric, stat.average),
        "care-chart-average",
      ),
    );
  return figure;
}

function table(data) {
  const details = el("details", undefined, "care-daily-table");
  details.append(el("summary", "查看逐日数值"));
  const tbl = el("table"),
    header = tbl.createTHead().insertRow();
  for (const title of ["日期", "奶量", "睡眠", "便便"]) {
    const th = el("th", title);
    th.scope = "col";
    header.append(th);
  }
  const tbody = tbl.createTBody();
  for (const row of [...data.rows].reverse()) {
    const tr = tbody.insertRow(),
      th = el("th", compactDay(row.day));
    th.scope = "row";
    tr.append(th);
    for (const key of Object.keys(metrics))
      tr.append(el("td", displayValue(key, row[key])));
  }
  details.append(tbl);
  return details;
}

function touchesDay(item, row) {
  const start = Date.parse(item.created);
  if (start >= row.start && start < row.end) return true;
  if (item.kind !== "sleep" || !("sleepEnd" in item) || start >= row.start)
    return false;
  return item.sleepEnd === null || Date.parse(item.sleepEnd) > row.start;
}

function handoff(data, ctx, state) {
  const section = el("section", undefined, "care-handoff");
  section.append(el("h3", "交班给家人"));
  if (!data.records.length) {
    section.append(
      el("p", "有照护记录后，就能勾选要交接的内容。", "care-subtle"),
    );
    return section;
  }
  const dateField = el("label", "选择日期", "care-handoff-date");
  const date = el("input");
  date.type = "date";
  date.min = data.rows[0].day;
  date.max = data.rows.at(-1).day;
  const latest =
    [...data.rows]
      .reverse()
      .find((row) => data.records.some((item) => touchesDay(item, row)))?.day ??
    date.max;
  date.value =
    state.handoffDay >= date.min && state.handoffDay <= date.max
      ? state.handoffDay
      : latest;
  dateField.append(date);
  const list = el("div", undefined, "care-handoff-list"),
    tools = el("div", undefined, "care-handoff-tools");
  const all = btn("勾选当天", "quiet"),
    clear = btn("清空选择", "quiet");
  tools.append(all, clear);
  const previewLabel = el("label", "将要交接的文字", "care-handoff-preview");
  const preview = el("textarea");
  preview.readOnly = true;
  preview.rows = 4;
  previewLabel.append(preview);
  const actions = el("div", undefined, "care-handoff-tools");
  const copy = btn("复制交班文字", "solid");
  const nativeShare = globalThis.window?.xiaomaiNative?.shareText;
  const canShare = Boolean(nativeShare || navigator.share);
  const share = btn("分享给家人", "quiet"),
    status = el("span", "", "care-subtle");
  status.setAttribute("role", "status");
  actions.append(copy);
  if (canShare) actions.append(share);
  actions.append(status);
  let dayItems = [];
  const included = new Set(data.records.map((item) => item.id));
  for (const id of state.selected)
    if (!included.has(id)) state.selected.delete(id);
  function update() {
    const selected = data.records.filter((item) => state.selected.has(item.id));
    preview.value = handoffText(ctx.profile?.()?.name, selected);
    copy.disabled = share.disabled = !selected.length;
    clear.disabled = !selected.length;
    previewLabel.hidden = !selected.length;
    status.textContent = selected.length
      ? "已选 " + selected.length + " 条"
      : "勾选要交接的记录，可跨天选择。";
  }
  function showDay() {
    state.handoffDay = date.value;
    list.replaceChildren();
    const row = data.rows.find((value) => value.day === date.value);
    dayItems = row ? data.records.filter((item) => touchesDay(item, row)) : [];
    all.disabled = !dayItems.length;
    if (!dayItems.length)
      list.append(el("p", "当天没有照护记录。", "care-subtle"));
    for (const item of dayItems) {
      const line = el("label"),
        box = el("input");
      box.type = "checkbox";
      box.checked = state.selected.has(item.id);
      box.onchange = () => {
        if (box.checked) state.selected.add(item.id);
        else state.selected.delete(item.id);
        update();
      };
      line.append(
        box,
        el("span", careTime(item.created) + "  " + careDescription(item)),
      );
      list.append(line);
    }
    update();
  }
  date.onchange = showDay;
  all.onclick = () => {
    for (const item of dayItems) state.selected.add(item.id);
    showDay();
  };
  clear.onclick = () => {
    state.selected.clear();
    showDay();
  };
  copy.onclick = async () => {
    try {
      if (navigator.clipboard?.writeText)
        await navigator.clipboard.writeText(preview.value);
      else {
        preview.focus();
        preview.select();
        preview.setSelectionRange(0, preview.value.length);
        if (!document.execCommand("copy")) throw new Error("manual");
      }
      status.textContent = "已复制，可粘贴到微信。";
    } catch {
      preview.focus();
      preview.select();
      preview.setSelectionRange(0, preview.value.length);
      status.textContent = "文字已选中，请长按复制。";
    }
  };
  share.onclick = async () => {
    try {
      if (nativeShare)
        await globalThis.window.xiaomaiNative.shareText({
          text: preview.value,
        });
      else await navigator.share({ text: preview.value });
    } catch (error) {
      if (error.name !== "AbortError")
        status.textContent = "可点「复制交班文字」粘贴到微信。";
    }
  };
  section.append(dateField, tools, list, previewLabel, actions);
  showDay();
  return section;
}

const states = new WeakMap();
export function mountCareTrends(container, ctx) {
  let state = states.get(ctx.checkins);
  if (!state) {
    state = { days: 7, selected: new Set(), handoffDay: "" };
    states.set(ctx.checkins, state);
  }
  function refresh() {
    const data = careStats(ctx.checkins, state.days);
    const fragment = document.createDocumentFragment();
    const header = el("div", undefined, "care-trends-heading");
    header.append(el("h3", "照护趋势"));
    const ranges = el("div", undefined, "care-range");
    ranges.setAttribute("role", "group");
    ranges.setAttribute("aria-label", "统计时段");
    for (const days of [7, 30]) {
      const range = btn("近 " + days + " 天");
      range.setAttribute("aria-pressed", String(days === state.days));
      range.onclick = () => {
        if (days !== state.days) {
          state.days = days;
          refresh();
          container
            .querySelector('.care-range [aria-pressed="true"]')
            ?.focus({ preventScroll: true });
        }
      };
      ranges.append(range);
    }
    header.append(ranges);
    const counts = el(
      "p",
      compactDay(data.rows[0].day) +
        " 至 " +
        compactDay(data.rows.at(-1).day) +
        " · 有照护记录 " +
        data.observed +
        " 天",
      "care-subtle",
    );
    const charts = el("div", undefined, "care-chart-grid");
    for (const key of Object.keys(metrics)) charts.append(chart(data, key));
    const guide = el(
      "p",
      "空心点表示未记录，短横表示已记为 0。睡眠按本机日期拆分，仅计已结束的时段。",
      "care-subtle",
    );
    const info = el(
      "p",
      "喂养 " +
        data.feedCount +
        " 次 · " +
        (data.meanInterval === null
          ? "平均间隔数据不足"
          : "平均间隔 " +
            duration(data.meanInterval) +
            "（" +
            data.intervalCount +
            " 段）"),
      "care-feeds-summary",
    );
    if (!data.feedCount) info.textContent = "这段时间没有喂养记录。";
    fragment.append(
      header,
      counts,
      charts,
      guide,
      info,
      table(data),
      handoff(data, ctx, state),
    );
    const wrapper = el("div", undefined, "care-trends");
    wrapper.append(fragment);
    container.replaceChildren(wrapper);
  }
  refresh();
}
