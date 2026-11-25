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

function readLink(href, chapterId, generic = false, language = "") {
  const query = new URLSearchParams();
  const mappedChapter = generic ? null : editionInfo(href)?.chapter.id;
  query.set("chapter", mappedChapter || chapterId || "opening");
  query.set("part", href);
  if (generic) query.set("edition", "local");
  if (language) query.set("lang", language);
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

const langName = { zh: "中文", en: "英文" };
function recognizedLanguage(book) {
  const language = book.declaredLanguage || book.sampleLanguage;
  if (!Object.hasOwn(langName, language)) throw new Error("没有识别出这本 EPUB 的中文或英文正文。");
  if (book.declaredLanguage && book.sampleLanguage && book.declaredLanguage !== book.sampleLanguage)
    throw new Error("这份 EPUB 的语种标记和正文不一致，请检查文件后重试。");
  return language;
}

export function setupBookReader({ storage, native }) {
  buildMap();
  const prefs = readPrefs(storage);
  const viewport = $("reader-scroll"), content = $("reader-content");
  let chapter, request, currentPart, genericEdition = false, currentLanguage = null;
  let selection = 0, scrollerTimer, importTarget = "", transferredPosition = null;
  const editions = {};
  for (const code of ["zh", "en"]) {
    editions[code] = { book: null, pending: null, generation: 0, native: false, absent: false };
  }
  if (!prefs.positions) prefs.positions = {};
  if (!prefs.positions.en && prefs.last?.href && !prefs.last.language) prefs.positions.en = prefs.last;
  if (!prefs.localEditions) prefs.localEditions = { en: !!prefs.stored };
  let importNote = "", waitForPosition = false;
  const engine = () => import("./epub-engine.js");

  function savePrefs() {
    try { storage?.setItem(prefsKey, JSON.stringify(prefs)); } catch { /* Reading also works in memory. */ }
  }
  function status(text) { $("reader-state").textContent = text; }
  function available(language) {
    return !!(editions[language].book || prefs.localEditions[language] || editions[language].native);
  }
  function refreshManage() {
    $("reader-management").hidden = !available("zh") && !available("en");
    const selected = currentLanguage || (available("zh") ? "zh" : "en");
    $("reader-remove").textContent = "移除本机" + langName[selected] + "版";
  }
  function updateResume() {
    const resume = $("reader-resume");
    const last = prefs.positions[prefs.preferredLanguage || "zh"] || prefs.last;
    resume.href = readLink(last?.href || readerChapters[0].files[0].href, null, last?.generic);
    resume.textContent = last?.href ? "继续上次阅读" : "从封面读起";
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
    if (!currentPart || !currentLanguage || !viewport.clientHeight || waitForPosition) return;
    const available = viewport.scrollHeight - viewport.clientHeight;
    const ratio = available > 0 ? Math.min(1, Math.max(0, viewport.scrollTop / available)) : 0;
    const top = viewport.getBoundingClientRect().top + viewport.clientTop;
    const blocks = content.children;
    let lo = 0, hi = blocks.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (blocks[mid].getBoundingClientRect().bottom <= top) lo = mid + 1;
      else hi = mid;
    }
    const block = blocks[lo]?.getBoundingClientRect();
    const offset = block?.height ? Math.min(1, Math.max(0, (top - block.top) / block.height)) : 0;
    prefs.last = { href: currentPart, ratio, block: lo, offset, generic: genericEdition, language: currentLanguage };
    prefs.positions[currentLanguage] = prefs.last;
    savePrefs();
  }
  function leave() {
    clearTimeout(scrollerTimer);
    rememberPosition();
    selection++;
    request = null;
    currentPart = null;
    currentLanguage = null;
    waitForPosition = false;
    document.body.removeAttribute("data-reading-book");
  }

  function showAvailability() {
    refreshManage();
    if (native?.hasPersonalEpub) {
      for (const code of ["zh","en"]) {
        native.hasPersonalEpub(code).then(value => {
          editions[code].native = value;
          refreshManage();
        }).catch(() => {});
      }
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

  async function currentBook(language) {
    const edition = editions[language];
    if (edition.book || edition.absent) return edition.book;
    if (!edition.pending) {
      const generation = edition.generation;
      edition.pending = (async () => {
        const api = await engine();
        let file, localError;
        try { file = await api.loadStoredEpub(language); } catch (error) { localError = error; }
        if (!file && native?.readPersonalEpub) {
          // An unseeded app returns null without asking for access.
          file = await native.readPersonalEpub(language);
        }
        if (!file) {
          if (localError) throw localError;
          if (generation === edition.generation) edition.absent = true;
          return null;
        }
        const parsed = validTitle(await api.openEpub(file));
        let detected;
        try { detected = recognizedLanguage(parsed); }
        catch (error) { parsed.dispose(); throw error; }
        if (detected !== language || generation !== edition.generation) {
          parsed.dispose();
          if (detected !== language && generation === edition.generation) edition.absent = true;
          return edition.book;
        }
        edition.book = parsed;
        return parsed;
      })().finally(() => { if (generation === edition.generation) edition.pending = null; });
    }
    return edition.pending;
  }

  function matchPart(href, book) {
    return book.spine.findIndex(part => part.href === pathOf(href));
  }
  function setPagerLink(id, file) {
    const control = $(id);
    if (file) {
      control.href = readLink(file.href, chapter.id, genericEdition, request.get("lang") || "");
      control.removeAttribute("aria-disabled");
    } else {
      control.removeAttribute("href");
      control.setAttribute("aria-disabled", "true");
    }
  }

  function showImporter(language = "") {
    importTarget = language;
    $("reader-import-instruction").textContent = language
      ? "请选择《蒙台梭利婴儿》的" + langName[language] + "版 EPUB，书只保存在这台设备。"
      : "从手机或电脑选择自己的《蒙台梭利婴儿》中文或英文 EPUB，书只保存在这台设备。";
    $("reader-import").hidden = false;
  }
  function languageControls(code, book, missing) {
    const chinese = code === "zh";
    for (const language of ["zh", "en"]) {
      $("reader-language-" + language).setAttribute("aria-pressed", String(code === language));
    }
    content.lang = chinese ? "zh-CN" : "en";
    viewport.setAttribute("aria-label", chinese ? "中文正文" : "英文原文");
    let note = chinese ? (book.machineAssisted ? "小麦自译 · 机器辅助" : "本机中文版本") : "英文原版";
    if (missing) note += " · 本机暂无" + langName[missing] + "版";
    $("reader-language-note").textContent = note;
    $("reader-language").hidden = false;
  }

  async function switchLanguage(language) {
    if (language === currentLanguage) {
      prefs.preferredLanguage = language;
      savePrefs();
      $("reader-import").hidden = true;
      return;
    }
    const turn = selection;
    try {
      const next = await currentBook(language);
      if (turn !== selection) return;
      if (!next) {
        showImporter(language);
        status("本机暂时没有" + langName[language] + "版。");
        return;
      }
      rememberPosition();
      const aligned = !genericEdition && matchesEdition(next);
      const last = prefs.positions[language];
      const target = aligned ? currentPart : last?.href || next.spine[0].href;
      transferredPosition = aligned ? prefs.positions[currentLanguage] : null;
      prefs.preferredLanguage = language;
      savePrefs();
      const hash = readLink(target, chapter?.id, !matchesEdition(next), language);
      if (location.hash === hash) show(new URLSearchParams(hash.split("?")[1]));
      else location.hash = hash;
    } catch (error) {
      if (turn === selection) { status(error.message || "没有打开这本书。"); showImporter(language); }
    }
  }
  for (const code of ["zh", "en"]) $("reader-language-" + code).onclick = () => switchLanguage(code);
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
    for (const id of ["reader-language", "reader-toolbar", "reader-scroll", "reader-pager", "reader-import"]) $(id).hidden = true;
    status("正在打开本机原书…");
    try {
      const explicit = request.get("lang");
      const preferred = Object.hasOwn(langName, explicit) ? explicit : prefs.preferredLanguage === "en" ? "en" : "zh";
      let language = preferred, missing = "", unavailable;
      let book;
      try { book = await currentBook(language); } catch (error) { unavailable = error; }
      if (turn !== selection) return;
      if (!book) {
        missing = language;
        language = language === "zh" ? "en" : "zh";
        book = await currentBook(language);
      }
      if (turn !== selection) return;
      refreshManage();
      if (!book) {
        status(unavailable?.message || "");
        showImporter();
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
        const next = readLink(dest, chapter.id, genericEdition, request.get("lang") || "");
        if (location.hash !== next) location.hash = next;
        else show(new URLSearchParams(next.split("?")[1]));
      });
      if (turn !== selection) return;
      setControls(book, index);
      if (genericEdition) $("reader-page-title").textContent = part.title || book.title;
      content.replaceChildren(...slot.childNodes);
      for (const id of ["reader-toolbar", "reader-scroll", "reader-pager"]) $(id).hidden = false;
      currentPart = part.href;
      currentLanguage = language;
      languageControls(language, book, missing);
      refreshManage();
      waitForPosition = true;
      const prior = transferredPosition || prefs.positions[language] || prefs.last;
      transferredPosition = null;
      const last = prior?.href === currentPart ? prior : null;
      const ratio = Number.isFinite(last?.ratio) ? last.ratio : 0;
      const restore = () => {
        if (turn !== selection || !waitForPosition) return;
        if (anchor) viewport.scrollTop += anchor.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12;
        else if (ratio > 0 && last && Number.isInteger(last.block) && content.children[last.block]) {
          const block = content.children[last.block].getBoundingClientRect();
          viewport.scrollTop += block.top - viewport.getBoundingClientRect().top - viewport.clientTop + block.height * (last.offset || 0);
        } else viewport.scrollTop = ratio * (viewport.scrollHeight - viewport.clientHeight);
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
      status(importNote || unavailable?.message || (genericEdition ? "这份 EPUB 的分段和导图所用版本不同，阅读位置按本机这本书的目录排列。" : ""));
    } catch (error) {
      if (turn !== selection) return;
      status(error.message || "没有打开这份 EPUB，请重新选择文件。");
      showImporter();
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
    importTarget = "";
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
  $("reader-part").onchange = event => { location.hash = readLink(event.target.value, chapter.id, genericEdition, request?.get("lang") || ""); };
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
    const expected = importTarget;
    try {
      const api = await engine();
      const next = validTitle(await api.openEpub(file));
      let language;
      try {
        language = recognizedLanguage(next);
        if (expected && expected !== language)
          throw new Error("这份文件是" + langName[language] + "版，请为当前入口选择" + langName[expected] + "版。");
      } catch (error) { next.dispose(); throw error; }
      const edition = editions[language];
      const generation = ++edition.generation;
      edition.pending = null;
      try {
        await api.saveStoredEpub(file, language);
        importNote = "";
        prefs.localEditions[language] = true;
        if (language === "en") prefs.stored = true;
      } catch (error) {
        importNote = (error.message || "当前设备未保存书稿。") + " 本次仍可阅读。";
      }
      if (generation !== edition.generation) { next.dispose(); return; }
      edition.book?.dispose();
      edition.book = next;
      edition.absent = false;
      let nextHash;
      if (request?.has("part") && (expected || request.has("lang"))) {
        rememberPosition();
        if (currentLanguage !== language && currentPart && !genericEdition && matchesEdition(next))
          transferredPosition = prefs.positions[currentLanguage];
        if (expected) prefs.preferredLanguage = language;
        nextHash = readLink(request.get("part"), chapter.id, request.get("edition") === "local", language);
      }
      savePrefs();
      if (nextHash && location.hash !== nextHash) location.hash = nextHash;
      else if (request) show(request);
      else refreshManage();
    } catch (error) {
      status(error.message || "导入失败，请重新选择 EPUB。");
    }
  };
  $("reader-replace").onclick = () => { importTarget = ""; $("reader-file").click(); };
  $("reader-remove").onclick = async () => {
    const language = currentLanguage || (available("zh") ? "zh" : "en");
    if (!window.confirm("从这台设备移除《蒙台梭利婴儿》" + langName[language] + "版及该版本的阅读进度？")) return;
    const edition = editions[language];
    ++edition.generation;
    edition.pending = null;
    try {
      const api = await engine();
      await api.removeStoredEpub(language);
      if (native?.removePersonalEpub) await native.removePersonalEpub(language);
      edition.book?.dispose();
      edition.book = null;
      edition.native = false;
      edition.absent = true;
      importNote = "";
      currentPart = null;
      delete prefs.localEditions[language];
      delete prefs.positions[language];
      if (language === "en") delete prefs.stored;
      if (prefs.last?.language === language || (language === "en" && !prefs.last?.language))
        prefs.last = prefs.positions[language === "zh" ? "en" : "zh"] || null;
      if (prefs.preferredLanguage === language) delete prefs.preferredLanguage;
      savePrefs();
      if (request) show(request);
      status("已移除本机" + langName[language] + "版。");
    } catch (error) { status(error.message || "未能移除本机电子书，请重试。"); }
  };
  return { show, leave };
}
