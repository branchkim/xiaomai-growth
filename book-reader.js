import { readerChapters, readerGroups } from "./book-chapters.js";

const base = "#journal/reader";
const guide = "#journal/index?book=montessori-baby";
const prefsKey = "xiaomai/reader/montessori-baby";
const $ = id => document.getElementById(id);
const pathOf = href => href.split("#")[0];
const basename = href => pathOf(href).split("/").at(-1);
const chapterById = new Map(readerChapters.map(chapter => [chapter.id, chapter]));
const fileByName = new Map(readerChapters.flatMap(chapter =>
  chapter.files.map(file => [basename(file.href), { chapter, label: file.label }])));
const editionInfo = href => fileByName.get(basename(href));
const knownOrder = readerChapters.flatMap(chapter => chapter.files.map(file => basename(file.href)));

function matchesEdition(book) {
  return book.spine.length === knownOrder.length &&
    book.spine.every((part, i) => basename(part.href) === knownOrder[i]);
}

function link(href, text) {
  const a = document.createElement("a");
  a.href = href;
  a.textContent = text;
  return a;
}

function chapterLink(id) {
  return base + "?chapter=" + encodeURIComponent(id);
}

function readLink(href, chapterId, generic = false) {
  const query = new URLSearchParams();
  const mappedChapter = generic ? null : editionInfo(href)?.chapter.id;
  query.set("chapter", mappedChapter || chapterId || "opening");
  query.set("part", href);
  if (generic) query.set("edition", "local");
  return base + "?" + query;
}

function buildMap() {
  for (const group of readerGroups) {
    const branch = document.createElement("section");
    branch.className = "reader-branch";
    const heading = document.createElement("h4");
    heading.textContent = group.title;
    const list = document.createElement("ul");
    list.className = "reader-leaves";
    for (const chapter of readerChapters.filter(chapter => chapter.group === group.id)) {
      const item = document.createElement("li");
      item.className = "reader-node";
      const a = link(chapterLink(chapter.id), chapter.title);
      a.dataset.readerChapter = chapter.id;
      item.append(a);
      list.append(item);
    }
    branch.append(heading, list);
    $("reader-groups").append(branch);
  }
}

function readPrefs(storage) {
  try {
    const prefs = JSON.parse(storage?.getItem(prefsKey) || "{}");
    return prefs && typeof prefs === "object" ? prefs : {};
  } catch { return {}; }
}

function validTitle(book) {
  if (/\bmontessori\s+baby\b|蒙(?:台梭利|臺梭利|特梭利|特索利).*[婴嬰][兒儿]/i.test(book.title)) return book;
  book.dispose();
  throw new Error("请选择《The Montessori Baby》的 EPUB 文件。");
}

export function setupBookReader({ storage, native }) {
  buildMap();
  const prefs = readPrefs(storage);
  const viewport = $("reader-scroll"), content = $("reader-content");
  let chapter, request, opened, pendingLoad, currentPart, genericEdition = false;
  let selection = 0, revision = 0, scrollerTimer, hasNative = false;
  let importNote = "", waitForPosition = false;
  const engine = () => import("./epub-engine.js");

  function savePrefs() {
    try { storage?.setItem(prefsKey, JSON.stringify(prefs)); } catch { /* Reading also works in memory. */ }
  }
  function status(text) { $("reader-state").textContent = text; }
  function refreshManage() {
    $("reader-management").hidden = !(opened || prefs.stored || hasNative);
  }
  function updateResume() {
    const resume = $("reader-resume");
    resume.href = readLink(prefs.last?.href || readerChapters[0].files[0].href, null, prefs.last?.generic);
    resume.textContent = prefs.last?.href ? "继续上次阅读" : "从封面读起";
  }
  function fontSize() {
    return [16, 18, 20, 22, 24].includes(prefs.font) ? prefs.font : 18;
  }
  function applyFont() {
    const size = fontSize();
    content.style.fontSize = size + "px";
    $("reader-smaller").disabled = size <= 16;
    $("reader-larger").disabled = size >= 24;
  }
  function rememberPosition() {
    if (!currentPart || !viewport.clientHeight || waitForPosition) return;
    const available = viewport.scrollHeight - viewport.clientHeight;
    const ratio = available > 0 ? Math.min(1, Math.max(0, viewport.scrollTop / available)) : 0;
    prefs.last = { href: currentPart, ratio, generic: genericEdition };
    savePrefs();
  }
  function leave() {
    clearTimeout(scrollerTimer);
    rememberPosition();
    selection++;
    request = null;
    currentPart = null;
    waitForPosition = false;
    document.body.removeAttribute("data-reading-book");
  }

  function showAvailability() {
    refreshManage();
    if (native?.hasPersonalEpub) {
      native.hasPersonalEpub().then(value => {
        hasNative = value;
        refreshManage();
      }).catch(() => {});
    }
  }
  function showIntro() {
    $("reader-chapter-title").textContent = chapter.title;
    $("reader-intro").textContent = chapter.intro;
    $("reader-start").href = readLink(chapter.files[0].href, chapter.id);
    const practice = $("reader-practices");
    practice.hidden = chapter.id === "opening" || chapter.id === "credits";
    practice.href = guide + "&theme=" + chapter.id;
    $("reader-chapter-parts").replaceChildren(...chapter.files.map(file => {
      const row = document.createElement("li");
      row.append(link(readLink(file.href, chapter.id), file.label));
      return row;
    }));
  }

  async function currentBook() {
    if (opened) return opened;
    if (!pendingLoad) {
      const generation = revision;
      pendingLoad = (async () => {
        const api = await engine();
        let file, localError;
        try { file = await api.loadStoredEpub(); } catch (error) { localError = error; }
        if (!file && native?.readPersonalEpub) {
          // An unseeded app returns null without asking for access.
          file = await native.readPersonalEpub();
        }
        if (!file) {
          if (localError) throw localError;
          return null;
        }
        const parsed = validTitle(await api.openEpub(file));
        if (generation !== revision) {
          parsed.dispose();
          return opened;
        }
        opened = parsed;
        return opened;
      })().finally(() => { if (generation === revision) pendingLoad = null; });
    }
    return pendingLoad;
  }

  function matchPart(href, book) {
    return book.spine.findIndex(part => part.href === pathOf(href));
  }
  function setPagerLink(id, file) {
    const control = $(id);
    if (file) {
      control.href = readLink(file.href, chapter.id, genericEdition);
      control.removeAttribute("aria-disabled");
    } else {
      control.removeAttribute("href");
      control.setAttribute("aria-disabled", "true");
    }
  }
  function setControls(book, index) {
    const pageParts = book.spine;
    const select = $("reader-part");
    select.replaceChildren(...pageParts.map((part, i) => {
      const entry = !genericEdition && editionInfo(part.href);
      const text = entry ? entry.chapter.title + " / " + entry.label : part.title;
      return new Option((i + 1) + ". " + text, part.href);
    }));
    select.value = pageParts[index].href;
    setPagerLink("reader-prev", pageParts[index - 1]);
    setPagerLink("reader-next", pageParts[index + 1]);
    $("reader-page-count").textContent = (index + 1) + " / " + pageParts.length;
    applyFont();
  }

  async function showPart(href, turn) {
    const localSource = editionInfo(href);
    $("reader-page-title").textContent = localSource?.chapter.title || chapter.title;
    $("reader-back-chapter").href = chapterLink(localSource?.chapter.id || chapter.id);
    content.replaceChildren();
    for (const id of ["reader-toolbar", "reader-scroll", "reader-pager", "reader-import"]) $(id).hidden = true;
    status("正在打开本机原书…");
    try {
      const book = await currentBook();
      if (turn !== selection) return;
      refreshManage();
      if (!book) {
        status("");
        $("reader-import").hidden = false;
        return;
      }
      genericEdition = !matchesEdition(book);
      const followLocal = request.get("edition") === "local";
      let index = genericEdition && !followLocal ? 0 : matchPart(href, book);
      let target = genericEdition && !followLocal ? book.spine[0].href : href;
      if (index < 0) {
        index = book.spine.findIndex(part => basename(part.href) === basename(href));
        if (index >= 0) target = book.spine[index].href + href.slice(pathOf(href).length);
        else { index = 0; target = book.spine[index].href; }
      }
      const part = book.spine[index];
      const slot = document.createElement("div");
      const { anchor } = await book.render(target, slot, dest => {
        const next = readLink(dest, chapter.id, genericEdition);
        if (location.hash !== next) location.hash = next;
        else show(new URLSearchParams(next.split("?")[1]));
      });
      if (turn !== selection) return;
      setControls(book, index);
      if (genericEdition) $("reader-page-title").textContent = part.title || book.title;
      content.replaceChildren(...slot.childNodes);
      for (const id of ["reader-toolbar", "reader-scroll", "reader-pager"]) $(id).hidden = false;
      currentPart = part.href;
      waitForPosition = true;
      const last = prefs.last;
      const ratio = last?.href === currentPart && Number.isFinite(last.ratio) ? last.ratio : 0;
      const restore = () => {
        if (turn !== selection || !waitForPosition) return;
        if (anchor) viewport.scrollTop += anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12;
        else viewport.scrollTop = ratio * (viewport.scrollHeight - viewport.clientHeight);
      };
      restore();
      const images = [...content.querySelectorAll("img")].filter(img => !img.complete);
      // Raster dimensions can change the height after a saved position was first restored.
      Promise.allSettled(images.map(img => img.decode())).then(() => {
        if (turn !== selection || !waitForPosition) return;
        restore();
        waitForPosition = false;
        rememberPosition();
      });
      status(importNote || (genericEdition ? "这份 EPUB 的分段和导图所用版本不同，阅读位置按本机这本书的目录排列。" : ""));
    } catch (error) {
      if (turn !== selection) return;
      status(error.message || "没有打开这份 EPUB，请重新选择文件。");
      $("reader-import").hidden = false;
    }
  }

  function show(params) {
    leave();
    const turn = selection;
    request = new URLSearchParams(params);
    chapter = chapterById.get(params.get("chapter"));
    const href = params.get("part") || "";
    const isPage = !!href;
    document.body.toggleAttribute("data-reading-book", isPage);
    if (isPage && !chapter) chapter = editionInfo(href)?.chapter || readerChapters[0];
    $("reader-map").hidden = !!chapter;
    $("reader-overview").hidden = !chapter || isPage;
    $("reader-page").hidden = !isPage;
    $("reader-import").hidden = true;
    $("reader-management").open = false;
    status(importNote);
    showAvailability();
    if (isPage) void showPart(href, turn);
    else if (chapter) showIntro();
    else updateResume();
  }

  viewport.addEventListener("scroll", () => {
    clearTimeout(scrollerTimer);
    scrollerTimer = setTimeout(rememberPosition, 120);
  }, { passive: true });
  for (const event of ["touchstart", "pointerdown", "wheel", "keydown"]) {
    viewport.addEventListener(event, () => { waitForPosition = false; }, { passive: true });
  }
  window.addEventListener("pagehide", rememberPosition);
  document.addEventListener("visibilitychange", () => { if (document.hidden) rememberPosition(); });
  $("reader-part").onchange = event => { location.hash = readLink(event.target.value, chapter.id, genericEdition); };
  for (const [id, delta] of [["reader-smaller", -2], ["reader-larger", 2]]) {
    $(id).onclick = () => {
      const prior = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
      const fraction = viewport.scrollTop / prior;
      prefs.font = Math.max(16, Math.min(24, fontSize() + delta));
      applyFont();
      viewport.scrollTop = fraction * (viewport.scrollHeight - viewport.clientHeight);
      rememberPosition();
    };
  }
  $("reader-file").onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = "";
    status("正在检查电子书…");
    const generation = ++revision;
    pendingLoad = null;
    try {
      const api = await engine();
      const next = validTitle(await api.openEpub(file));
      if (generation !== revision) { next.dispose(); return; }
      try {
        await api.saveStoredEpub(file);
        importNote = "";
        prefs.stored = true;
      } catch (error) {
        importNote = (error.message || "当前设备未保存书稿。") + " 本次仍可阅读。";
      }
      if (generation !== revision) { next.dispose(); return; }
      opened?.dispose();
      opened = next;
      savePrefs();
      if (request) show(request);
      else refreshManage();
    } catch (error) {
      status(error.message || "导入失败，请重新选择 EPUB。");
    }
  };
  $("reader-replace").onclick = () => $("reader-file").click();
  $("reader-remove").onclick = async () => {
    if (!window.confirm("从这台设备移除《蒙台梭利婴儿》原书及阅读进度？")) return;
    ++revision;
    pendingLoad = null;
    try {
      const api = await engine();
      await api.removeStoredEpub();
      if (native?.removePersonalEpub) await native.removePersonalEpub();
      opened?.dispose();
      opened = null;
      hasNative = false;
      importNote = "";
      currentPart = null;
      delete prefs.stored;
      delete prefs.last;
      savePrefs();
      if (request) show(request);
      status("已移除本机原书。");
    } catch (error) { status(error.message || "未能移除本机电子书，请重试。"); }
  };
  return { show, leave };
}
