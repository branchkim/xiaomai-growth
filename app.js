import { Checkins, setupCheckins } from "./checkins.js";
import { Notebook } from "./notes.js";
import {
  ageWindow,
  includesMonth,
  availableFilters,
  makeSearchIndex,
  findCards,
} from "./library.js";
import { setupGrowth } from "./growth.js";
import { setupDeviceTools } from "./device-tools.js";
import { guideCardIds, guideHash, guideId, guideTitle, readGuide, setupGuide } from "./book-guide.js";
import { setupCrosswalk, appendBookSource } from "./book-review.js";
import { setupBookReader } from "./book-reader.js";

const $ = (id) => document.getElementById(id);
const native = window.xiaomaiNative;
document.documentElement.classList.toggle("native-shell", !!native);
function element(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
const paths = {
  book: '<path d="M12 6C8 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-6-1-10 2Zm0 0v15"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
  path: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h8a4 4 0 0 1 0 8H9a2 2 0 0 0 0 4h8"/>',
  index:
    '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  settings:
    '<path d="M4 7h8m4 0h4M4 17h2m4 0h10"/><circle cx="14" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  note: '<path d="m5 15 10-10 4 4L9 19l-5 1 1-5Zm8-8 4 4"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  care: '<path d="M12 21s8-4 8-11V5l-8-3-8 3v5c0 7 8 11 8 11Z"/><path d="M9 11h6m-3-3v6"/>',
  food: '<path d="M3 12h18a9 9 0 0 1-18 0Zm3 0 1-3m5 3 5-8M9 21h6"/>',
  talk: '<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 9h8m-8 3h5"/>',
  sprout:
    '<path d="M12 21V11m0 4C6 16 3 12 3 7c5 0 9 2 9 8Zm0-4c0-6 4-9 9-9 0 6-3 10-9 9Z"/>',
  sleep: '<path d="M20 14a8.5 8.5 0 0 1-10-11A9 9 0 1 0 20 14Z"/>',
};
function icon(name) {
  const span = element("span");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML =
    '<svg viewBox="0 0 24 24" focusable="false">' + paths[name] + "</svg>";
  return span;
}
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => el.append(icon(el.dataset.icon)));
const topicIcons = {
  喂养: "food",
  日常照护: "care",
  健康与安全: "care",
  语言与互动: "talk",
  睡眠与安抚: "sleep",
  情绪与陪伴: "talk",
};
let growth,
  data,
  cards,
  stages,
  book,
  searchIndex,
  filterOptions,
  activeStage,
  displayedHash,
  currentCard;
let storage;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
const checkins = new Checkins(storage);
const refreshCheckins = setupCheckins(checkins);

let journalPath = native?.surface === "journal";
let currentGuide, updateGuide, guideSearchIndex, lastLibraryHash, reader;
function libraryHash(path) {
  return (journalPath ? "#journal/" : "#") + path;
}
function stageHash(id) {
  return libraryHash("time/" + id);
}
function makeLink(text, href, cls) {
  const a = element("a", text, cls);
  a.href = href;
  return a;
}
function external(text, url) {
  const a = makeLink(text, url, "source-link");
  a.target = "_blank";
  a.rel = "noreferrer";
  return a;
}
function cardLink(card, withMeta = false) {
  const link = makeLink(undefined, "#card/" + card.id, "card-row");
  const kind = topicIcons[card.topic] || "sprout";
  const mark = element("span", undefined, "mark t-" + kind);
  mark.append(icon(kind));
  const copy = element("span", undefined, "row-copy");
  copy.append(element("span", card.title, "row-title"));
  if (withMeta)
    copy.append(
      element(
        "small",
        stages.get(card.stage).short + " · " + card.topic,
        "row-meta",
      ),
    );
  const end = element("span", undefined, "end");
  end.append(icon("right"));
  link.append(mark, copy, end);
  return link;
}
function setupTimeline() {
  for (const [i, stage] of data.stages.entries()) {
    const li = element("li");
    const button = element("button", undefined, "stage");
    button.id = "stage-" + stage.id;
    const image = element("img");
    image.src = "./assets/stage-" + (stage.art || stage.id) + ".webp";
    image.alt = "";
    const dot = element("span", undefined, "dot");
    dot.setAttribute("aria-hidden", "true");
    button.append(image, dot, element("span", stage.short));
    button.setAttribute("aria-label", stage.label + " · " + stage.name);
    button.onclick = () => selectStage(stage.id);
    li.append(button);
    $("stages").append(li);
    button.onkeydown = (e) => {
      const n =
        e.key === "ArrowLeft" ? i - 1 : e.key === "ArrowRight" ? i + 1 : null;
      if (n !== null && data.stages[n]) {
        e.preventDefault();
        selectStage(data.stages[n].id);
        $("stage-" + data.stages[n].id).focus({ preventScroll: true });
      }
    };
  }
  const step = (delta) => {
    const index = data.stages.findIndex((s) => s.id === activeStage),
      next = data.stages[index + delta];
    if (next) selectStage(next.id);
  };
  $("prev-stage").onclick = () => step(-1);
  $("next-stage").onclick = () => step(1);
}
function selectStage(id) {
  if (!stages.has(id)) return;
  history.replaceState(null, "", stageHash(id));
  if ($("home").hidden) {
    displayedHash = location.hash;
    drawTimeline(id);
    rememberJournalLink("time", location.hash);
  } else {
    displayRoute(location.hash);
  }
}
function drawTimeline(id) {
  activeStage = id;
  try {
    storage?.setItem("xiaomai/stage", id);
  } catch {}
  const stage = stages.get(id),
    position = data.stages.indexOf(stage);
  const current = $("stage-" + id);
  for (const btn of $("stages").querySelectorAll("button")) {
    if (btn === current) btn.setAttribute("aria-current", "step");
    else btn.removeAttribute("aria-current");
  }
  $("prev-stage").disabled = position === 0;
  $("next-stage").disabled = position === data.stages.length - 1;
  $("phase-age").textContent = stage.label;
  $("phase-title").textContent = stage.name;
  $("phase-focus").textContent = stage.focus;
  $("all-stage").href = libraryHash("index?stage=" + id);
  $("all-stage").textContent =
    "查看本阶段 " + data.cards.filter((c) => c.stage === id).length + " 张";
  $("featured").replaceChildren(
    ...stage.featured.map((key) => cardLink(cards.get(key))),
  );
  const strip = $("stages"),
    box = strip.getBoundingClientRect(),
    target = current.getBoundingClientRect();
  if (target.left < box.left || target.right > box.right)
    strip.scrollLeft += target.left - box.left - (box.width - target.width) / 2;
}

const filterNames = {
  stage: "时间线章节",
  age: "宝宝已满月龄",
  topic: "主题",
  scene: "家庭场景",
  lens: "教育视角",
};
function setupIndex() {
  setupCrosswalk({ cards, element, makeLink });
  updateGuide = setupGuide({ element, makeLink, external });
  const byId = new Map(searchIndex.map(entry => [entry.card.id, entry]));
  guideSearchIndex = guideCardIds.map(id => byId.get(id)).filter(Boolean);
  for (const [key, label] of Object.entries(filterNames)) {
    const wrap = element("label", label);
    const select = element("select");
    select.id = "filter-" + key;
    select.append(new Option("全部", ""));
    for (const [v, text] of filterOptions[key])
      select.append(new Option(text, v));
    select.onchange = saveQuery;
    wrap.append(select);
    $("filter-fields").append(wrap);
  }
  const favoriteOnly = element("label", undefined, "favorite-only");
  const check = element("input");
  check.type = "checkbox";
  check.id = "filter-favorite";
  check.onchange = saveQuery;
  favoriteOnly.append(check, document.createTextNode("只看我的收藏"));
  $("filter-fields").append(favoriteOnly);
  const done = element("button", "收起筛选", "tools filter-done");
  done.onclick = () => {
    $("filter-panel").open = false;
    $("filter-panel").querySelector("summary").focus();
  };
  $("filter-fields").append(done);
  for (const term of ["红屁股", "抢勺子", "蒙氏", "奶奶带娃"]) {
    const b = element("button", term);
    b.onclick = () => {
      setFilterValues(new URLSearchParams());
      $("search").value = term;
      saveQuery();
    };
    $("quick-search").append(b);
  }
  $("search").oninput = saveQuery;
  $("clear").onclick = () => {
    setFilterValues(new URLSearchParams());
    saveQuery();
    $("search").focus();
  };
}
function readFilters() {
  const filters = {
    q: $("search").value,
    favorite: $("filter-favorite").checked ? "1" : "",
  };
  for (const key of Object.keys(filterNames))
    filters[key] = $("filter-" + key).value;
  return filters;
}
function setFilterValues(params) {
  $("search").value = params.get("q") || "";
  $("filter-favorite").checked = params.get("favorite") === "1";
  for (const key of Object.keys(filterNames)) {
    const value = params.get(key), select = $("filter-" + key);
    select.querySelector("[data-legacy-age]")?.remove();
    if (key === "age" && value?.includes("-")) {
      const original = data.cards.find((c) => c.activity?.window.join("-") === value);
      if (original) {
        const option = new Option(ageWindow(original.activity), value);
        option.dataset.legacyAge = "";
        select.add(option);
      }
    }
    select.value = Array.from(select.options).some((o) => o.value === value) ? value : "";
  }
}
function saveQuery() {
  const filters = readFilters(),
    params = new URLSearchParams();
  if (currentGuide) {
    params.set("book", guideId);
    if (currentGuide.topic) params.set("theme", currentGuide.topic.id);
  }
  for (const [key, value] of Object.entries(filters))
    if (value.trim()) params.set(key, value.trim());
  const query = params.toString();
  history.replaceState(null, "", libraryHash("index" + (query ? "?" + query : "")));
  displayedHash = location.hash;
  if (currentGuide) updateGuide(params);
  else lastLibraryHash = displayedHash;
  rememberJournalLink("index", location.hash);
  drawIndex();
}
function drawIndex() {
  const filters = readFilters();
  const scopedIndex = currentGuide?.topic
    ? guideSearchIndex.filter(entry => currentGuide.topic.cards.includes(entry.card.id))
    : currentGuide ? guideSearchIndex : searchIndex;
  const matches = findCards(scopedIndex, filters).filter(
    (card) => !filters.favorite || book.favorites.has(card.id),
  );
  const active = Object.keys(filterNames).filter((k) => filters[k]);
  const count = active.length + (filters.favorite ? 1 : 0);
  $("filter-label").textContent = "筛选" + (count ? " · " + count : "");
  $("match-count").textContent =
    (filters.favorite ? "我的收藏 · " : "") +
    (active.length
      ? active
          .map((k) => $("filter-" + k).selectedOptions[0]?.textContent)
          .join(" / ") + " · "
      : "") +
    "共 " +
    matches.length +
    " 张";
  $("clear").hidden = !(filters.q || count);
  $("results").replaceChildren(...matches.map((card) => cardLink(card, true)));
  if (!matches.length)
    $("results").append(
      element("p", "没有找到卡片，可以换个词或清除筛选。", "empty"),
    );
}
function renderNotes() {
  const entries = [...book.entries].sort(
    (a, b) => Date.parse(b[1].updated) - Date.parse(a[1].updated),
  );
  $("note-count").textContent = entries.length
    ? entries.length + " 条 · 仅本机可见"
    : "仅本机可见";
  const list = $("notes-list");
  list.replaceChildren();
  if (!entries.length) {
    const box = element("div", undefined, "empty");
    box.append(
      element("h2", "还没有记录"),
      element("p", "点开卡片里的「我家的经验」，写下第一次观察。"),
      makeLink("去选一张卡片", libraryHash("index")),
    );
    list.append(box);
    return;
  }
  const dates = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  for (const [id, item] of entries) {
    const card = cards.get(id),
      article = element("article", undefined, "note-item"),
      h = element("h2");
    h.append(makeLink(card.title, "#card/" + id));
    article.append(
      h,
      element(
        "small",
        stages.get(card.stage).short +
          " · " +
          dates.format(new Date(item.updated)),
      ),
      element("p", item.text),
    );
    list.append(article);
  }
}

function part(parent, heading, text) {
  parent.append(element("h3", heading), element("p", text));
}
function addSteps(parent, arr) {
  const ol = element("ol");
  for (const s of arr) ol.append(element("li", s));
  parent.append(ol);
}
function fold(title, cls = "fold") {
  const d = element("details", undefined, cls);
  d.append(element("summary", title));
  return d;
}
function practice(parent, activity, mainObservation) {
  part(parent, "什么时候试", activity.signal);
  part(parent, "手边材料", activity.materials);
  if (activity.steps) {
    part(parent, "这样做的原因", activity.reason);
    addSteps(parent, activity.steps);
  }
  if (mainObservation && mainObservation !== activity.observe) part(parent, "活动时观察", activity.observe);
  part(parent, "什么时候停", activity.stop);
}
function drawFavorite() {
  const saved = book.favorites.has(currentCard);
  $("favorite-card").setAttribute("aria-pressed", String(saved));
  $("favorite-card").lastElementChild.textContent = saved ? "已收藏" : "收藏";
}
$("favorite-card").onclick = () => {
  if (!currentCard) return;
  const saved = book.setFavorite(currentCard, !book.favorites.has(currentCard));
  drawFavorite();
  if (!saved) $("favorite-card").lastElementChild.textContent += "（仅本次）";
};
function showCard(card) {
  currentCard = card.id;
  drawFavorite();
  const a = card.activity;
  $("detail-stage").textContent = [
    stages.get(card.stage).short,
    card.topic,
  ].join(" · ");
  $("detail-title").textContent = card.title;
  const root = $("detail-content");
  root.replaceChildren();
  if (a && !a.title)
    root.append(
      element(
        "p",
        a.lens + " · " + ageWindow(a) + "，结合宝宝当下表现选择。",
        "detail-signal",
      ),
    );
  part(root, "为什么做", card.reason);
  if (a && !a.title) {
    part(root, "什么时候试", a.signal);
    part(root, "手边材料", a.materials);
  }
  root.append(element("h3", "在家怎么做"));
  addSteps(root, card.steps);
  part(root, "要观察什么", card.observation || a?.observe || "留意孩子的反应和照护前后的变化。");
  if (a && !a.title) part(root, "什么时候停", a.stop);
  if (a?.title) {
    const d = fold(a.title);
    d.append(element("p", a.lens + " · " + ageWindow(a), "detail-signal"));
    practice(d, a, card.observation);
    const parentParams = new URLSearchParams(
      (history.state?.cardFrom || "").split("?")[1] || "",
    );
    d.open = !!(
      parentParams.get("q") ||
      parentParams.get("lens") ||
      parentParams.get("age")
    );
    root.append(d);
  }
  growth.cardPractice(card, root);
  appendBookSource(root, card.id, { element, fold });
  const refs = fold("参考资料");
  const urls = new Set();
  for (const id of new Set([...(a?.sources || []), ...(card.sources || [])])) {
    const s = data.sources[id];
    refs.append(external(s.role + " · " + s.title, s.url));
    urls.add(s.url);
  }
  if (!urls.has(card.reference))
    refs.append(external("查看这张卡片的照护依据", card.reference));
  root.append(refs);
  $("note-prompt").textContent = "这次试了什么？孩子有什么反应？";
  $("experience").value = book.entries.get(card.id)?.text || "";
  $("entry").open =
    !!$("experience").value || ["#journal/notes", "#notes"].includes(history.state?.cardFrom);
  $("save-state").textContent = book.pending.has(card.id)
    ? "设备未保存，请在安装与备份中导出。"
    : "输入后自动保存到本机";
  $("related").replaceChildren();
  if (card.related?.length) {
    $("related").append(element("h3", "接着看"));
    for (const id of card.related)
      $("related").append(makeLink(cards.get(id).title, "#card/" + id));
  }
  const d = $("card-dialog");
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
function showResources() {
  const root = $("sources-list");
  root.replaceChildren();
  root.append(element("h3", "养育指南、理念与活动参考"));
  for (const s of Object.values(data.sources))
    root.append(external(s.role + " · " + s.title, s.url));
  const d = fold("项目参考");
  for (const r of data.resources) {
    d.append(external(r.name, r.url), element("p", r.about, "muted"));
  }
  root.append(d);
  $("resources-dialog").showModal();
}
function rememberJournalLink(view, hash) {
  if (journalPath) document.querySelector('[data-journal="' + view + '"]').href = hash;
}
function displayRoute(hash, scroll = true) {
  displayedHash = hash;
  const [raw, query = ""] = hash.slice(1).split("?");
  journalPath = raw === "journal" || raw.startsWith("journal/");
  const name = journalPath ? raw.slice("journal/".length) || "time" : raw;
  const section = name.split("/")[0];
  const view = ["time", "index", "notes", "reader", "growth"].includes(section) ? section : "home";
  const inJournal = ["time", "index", "notes", "reader"].includes(view);
  const dashboard = name === "growth/dashboard";
  const activeNav = dashboard ? "today" : inJournal ? "journal" : view;
  document.body.toggleAttribute("data-dashboard", dashboard);
  if (view !== "reader") reader.leave();
  for (const id of ["home", "index", "notes", "growth", "reader"]) $(id).hidden = id !== view;
  $("timeline").hidden = view !== "home" && view !== "time";
  $("journal-head").hidden = !inJournal;
  document.querySelectorAll("[data-view], [data-journal]").forEach((a) => {
    if (a.dataset.view === activeNav || a.dataset.journal === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (inJournal && journalPath && view !== "reader") rememberJournalLink(view, hash);
  if (view === "index") {
    const params = new URLSearchParams(query);
    const nextGuide = readGuide(params);
    if (!currentGuide || !nextGuide || currentGuide.topic !== nextGuide.topic) {
      $("guide-outline").open = false;
      $("guide-references").open = false;
    }
    currentGuide = nextGuide;
    if (!currentGuide) lastLibraryHash = hash;
    $("book-entry").hidden = !!currentGuide;
    $("book-guide").hidden = !currentGuide;
    $("book-library").hidden = !currentGuide;
    $("book-library").href = lastLibraryHash || libraryHash("index");
    $("index-sources").hidden = !!currentGuide;
    $("quick-search").hidden = !!currentGuide;
    $("index-title").textContent = currentGuide ? guideTitle : journalPath ? "知识库" : "知识索引";
    $("index-caption").textContent = currentGuide ? "已按英文原书核对 · 10 章、家庭实例与附录" : data.cards.length + " 张卡片";
    $("search").placeholder = currentGuide ? "搜专题里的做法或月龄" : "搜问题、家里的说法或材料";
    $("search").setAttribute("aria-label", currentGuide ? "搜索专题卡片" : "搜索知识索引");
    if (currentGuide) updateGuide(params);
    setFilterValues(params);
    drawIndex();
  } else if (view === "reader") {
    reader.show(new URLSearchParams(query));
  } else if (view === "growth") {
    growth.render(name.split("/")[1], query);
  } else if (view === "notes") {
    renderNotes();
  } else {
    const id = name.startsWith("time/") ? name.slice(5) : activeStage;
    drawTimeline(stages.has(id) ? id : data.stages[0].id);
  }
  if (!scroll) return;
  if (name === "checkin") $("checkin").scrollIntoView({ block: "start" });
  else window.scrollTo(0, 0);
}
function route() {
  if (!cards) return;
  const hash = location.hash || "#growth/dashboard";
  const id = hash.startsWith("#card/") ? hash.slice(6) : "";
  if (id && cards.has(id)) {
    const background = history.state?.cardFrom || stageHash(cards.get(id).stage);
    if (!currentCard && displayedHash !== background) displayRoute(background);
    showCard(cards.get(id));
    return;
  }
  const returning = !!currentCard && displayedHash === hash;
  if ($("card-dialog").open) $("card-dialog").close();
  currentCard = null;
  displayRoute(hash, !returning);
}
function closeCard() {
  if (history.state?.cardFrom) history.back();
  else {
    const target = stageHash(cards.get(currentCard)?.stage || activeStage);
    history.replaceState(null, "", target);
    route();
  }
}
function nativeDestination(hash) {
  if (!native?.openSection) return null;
  if (hash === "#checkin") return "checkin";
  if (hash === "#home") return "growth/dashboard";
  if (/^#growth\/dashboard(?:\?|$)/.test(hash)) return native.surface === "today" ? null : hash.slice(1);
  if (/^#growth(?:[/?]|$)/.test(hash) && native.surface !== "growth") return hash.slice(1);
  if (native.surface === "journal") return null;
  if (hash.startsWith("#journal/") || hash.startsWith("#card/")) return hash.slice(1);
  if (/^#(?:time|index|notes)(?:[/?]|$)/.test(hash)) return "journal/" + hash.slice(1);
  return null;
}
document.addEventListener("click", (event) => {
  const a = event.target.closest('a[href^="#"]');
  if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const hash = a.getAttribute("href");
  const destination = nativeDestination(hash);
  if (destination) {
    event.preventDefault();
    native.openSection({ hash: destination });
    return;
  }
  if (!hash.startsWith("#card/")) return;
  event.preventDefault();
  if (currentCard) history.replaceState(history.state, "", hash);
  else {
    // A filter can update the current page in place without firing hashchange.
    displayedHash = location.hash || "#growth/dashboard";
    history.pushState({ cardFrom: displayedHash }, "", hash);
  }
  route();
});
window.addEventListener("hashchange", route);
$("card-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeCard();
});
document.querySelectorAll("[data-close]").forEach(
  (b) =>
    (b.onclick = () => {
      const d = b.closest("dialog");
      if (d.id === "card-dialog") closeCard();
      else d.close();
    }),
);
document.querySelectorAll("dialog").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    ) {
      if (d.id === "card-dialog") closeCard();
      else d.close();
    }
  }),
);
document
  .querySelectorAll("[data-resources]")
  .forEach((b) => (b.onclick = showResources));
$("experience").oninput = () => {
  if (currentCard) {
    const ok = book.set(currentCard, $("experience").value);
    $("save-state").textContent = ok
      ? "已保存到本机"
      : "设备未保存。请保持页面打开，并在安装与备份中导出。";
  }
};
window.addEventListener("storage", () => {
  if (!book) return;
  book.read();
  if (!currentCard) {
    if (!$("notes").hidden) renderNotes();
    else if (!$("index").hidden) drawIndex();
  } else {
    drawFavorite();
    if (document.activeElement !== $("experience"))
      $("experience").value = book.entries.get(currentCard)?.text || "";
  }
});
async function init() {
  try {
    const response = await fetch("./cards.json");
    if (!response.ok) throw Error("cards");
    data = await response.json();
    cards = new Map(data.cards.map((c) => [c.id, c]));
    stages = new Map(data.stages.map((s) => [s.id, s]));
    book = new Notebook(storage, new Set(cards.keys()));
    const guideAliases = [guideTitle, "The Montessori Baby", "Simone Davies", "Junnifa Uzodike"];
    searchIndex = makeSearchIndex(data, new Map(guideCardIds.map(id => [id, guideAliases])));
    filterOptions = availableFilters(data);
    growth = setupGrowth({ storage, checkins, data });
    const profileAge = growth.ageMonths();
    activeStage = data.stages.find((s) => includesMonth(s.window, profileAge))?.id || data.stages[0].id;
    try {
      const saved = storage?.getItem("xiaomai/stage");
      if (stages.has(saved)) activeStage = saved;
    } catch {}
    checkins.profile = () => growth.store.profile();
    setupTimeline();
    reader = setupBookReader({ storage, native });
    setupIndex();
    setupDeviceTools(book, cards, checkins, growth, () => {
      growth.refresh();
      refreshCheckins();
      renderNotes();
      if (!$("index").hidden) drawIndex();
    });
    if (!location.hash) {
      const section = new URLSearchParams(location.search).get("open");
      const entryPoints = { timeline: "#time", knowledge: "#index", montessori: guideHash, reader: "#journal/reader", journal: "#journal/time", checkin: "#checkin", growth: "#growth", today: "#growth/dashboard" };
      history.replaceState(history.state, "", Object.hasOwn(entryPoints, section) ? entryPoints[section] : "#growth/dashboard");
    }
    route();
  } catch {
    $("notice").textContent = "手账暂时没有载入，请联网刷新。";
  }
}
init();
