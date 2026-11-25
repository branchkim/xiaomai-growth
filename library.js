export function ageWindow(activity) {
  const [start, end] = activity.window;
  return start === 0 ? "未满 " + end + " 个月" : "满 " + start + " 至未满 " + end + " 个月";
}

export function includesMonth(window, month) {
  return Number.isInteger(month) && !!window && month >= window[0] && month < window[1];
}

export function monthOptions(stages, cards = []) {
  const end = Math.max(0, ...stages.map((stage) => stage.window?.[1] || 0),
    ...cards.map((card) => card.activity?.window[1] || 0));
  return Array.from({ length: end }, (_, month) => [
    String(month), month === 0 ? "未满 1 个月" : "满 " + month + " 个月",
  ]);
}

export function availableFilters(data) {
  const unique = (values) =>
    [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return {
    stage: data.stages.map((s) => [s.id, s.label]),
    age: monthOptions(data.stages, data.cards),
    topic: unique(data.cards.map((c) => c.topic)).map((x) => [x, x]),
    scene: unique(data.cards.flatMap((c) => [c.scene, c.activity?.scene])).map((x) => [x, x]),
    lens: unique(data.cards.map((c) => c.activity?.lens)).map((x) => [x, x]),
  };
}

const normalize = (value) =>
  String(value || "").normalize("NFKC").toLowerCase().replace(/蒙氏|蒙特梭利|montessori/g, "蒙台梭利").replace(/\s+/g, "");

export function makeSearchIndex(data) {
  const stages = new Map(data.stages.map((s) => [s.id, s]));
  return data.cards.map((card) => {
    const a = card.activity || {}, stage = stages.get(card.stage);
    const groups = [
      [card.title, a.title],
      card.aliases,
      [card.topic, card.scene, a.scene, a.lens, stage.label, stage.name, a.window && ageWindow(a)],
      [a.materials, a.signal, card.reason, ...card.steps, card.observation, a.reason,
        ...(a.steps || []), a.observe, a.stop],
    ];
    return {
      card, window: a.window || stage.window,
      fields: groups.map((group) => group.filter(Boolean).map(normalize)),
    };
  });
}

function writtenNumber(text) {
  if (/^\d+$/.test(text)) return Number(text);
  const digits = "零一二三四五六七八九";
  const [tens, ones] = text.replace("两", "二").split("十");
  return ones === undefined ? digits.indexOf(tens)
    : (tens ? digits.indexOf(tens) : 1) * 10 + (ones ? digits.indexOf(ones) : 0);
}

function parseSearch(query) {
  const ranges = [];
  const number = "(\\d{1,3}|[零一二两三四五六七八九十]{1,3})";
  const unit = "(?:个\\s*月(?:龄)?|月龄|月)";
  // Chapter labels count ordinal months (第2个月); families usually search completed months (满2个月).
  const interval = new RegExp("(第|已满|满)?" + number + "(?:\\s*(?:周?岁|" + unit + "))?" +
    "\\s*[–—~～至到-]\\s*(未满|满)?\\s*" + number + "\\s*(周?岁|" + unit + ")", "gu");
  const age = new RegExp("(未满|已满|满|第)?\\s*" + number + "\\s*(?:周?岁(?:\\s*(半)|\\s*" +
    number + "\\s*" + unit + ")?|" + unit + ")", "gu");
  const words = query.normalize("NFKC")
    .replace(interval, (_, prefix, start, endPrefix, end, suffix) => {
      const scale = suffix.includes("岁") ? 12 : 1;
      const ordinal = prefix === "第";
      const upper = writtenNumber(end) + (ordinal || endPrefix === "未满" ? 0 : 1);
      ranges.push([Math.max(0, (writtenNumber(start) - (ordinal ? 1 : 0)) * scale), upper * scale]);
      return " ";
    })
    .replace(age, (match, prefix, count, half, extra) => {
      const n = (match.includes("岁") ? 12 : 1) * writtenNumber(count)
        + (half ? 6 : extra ? writtenNumber(extra) : 0);
      if (prefix === "未满") ranges.push([0, n]);
      else {
        const month = prefix === "第" ? n - 1 : n;
        ranges.push([month, month + 1]);
      }
      return " ";
    });
  return { ranges, terms: words.trim().split(/[\s，、,]+/u).map(normalize).filter(Boolean) };
}

export function findCards(index, filters) {
  const { ranges, terms } = parseSearch(filters.q || "");
  const matches = [];
  for (const { card, fields, window } of index) {
    const activity = card.activity || {};
    if (filters.stage && filters.stage !== card.stage) continue;
    if (filters.age) {
      // Shared links from the first-year edition use the exact activity interval.
      const fits = filters.age.includes("-")
        ? activity.window?.join("-") === filters.age
        : includesMonth(window, Number(filters.age));
      if (!fits) continue;
    }
    if (!ranges.every(([lo, hi]) => hi > lo && window && window[0] < hi && lo < window[1])) continue;
    if (filters.topic && filters.topic !== card.topic) continue;
    if (filters.scene && ![card.scene, activity.scene].includes(filters.scene)) continue;
    if (filters.lens && filters.lens !== activity.lens) continue;
    let score = 0;
    for (const term of terms) {
      const group = fields.findIndex((values) => values.some((value) => value.includes(term)));
      if (group < 0) { score = -1; break; }
      score += [12, 10, 6, 2][group];
    }
    if (score >= 0) matches.push({ card, score });
  }
  return matches.sort((a, b) => b.score - a.score).map((result) => result.card);
}
