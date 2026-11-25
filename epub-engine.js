import { inflateSync } from "./epub-inflate.js";

const MiB = 1024 * 1024;
const maxArchive = 64 * MiB;
const maxExpanded = 128 * MiB;
const maxPart = 24 * MiB;
const utf8 = new TextDecoder();
const BAD_ARCHIVE = "这份文件没有完整的 EPUB 书籍结构，请重新选择 EPUB 文件。";
const BAD_FORMAT = "此版本的电子书采用了暂不支持的格式或加密方式。";
const TOO_LARGE = "这份电子书超出了本机阅读器的容量。";
const imageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);
const markupTypes = new Set(["application/xhtml+xml", "text/html"]);
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

function valid(ok, message = BAD_ARCHIVE) {
  if (!ok) throw new Error(message);
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const b of bytes) value = crcTable[(value ^ b) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

// Index the central directory. Expand only the package, spine, TOC and supported images.
function zipReader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = at => view.getUint16(at, true);
  const u32 = at => view.getUint32(at, true);
  let end = bytes.length - 22;
  const cutoff = Math.max(0, end - 65535);
  while (end >= cutoff && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length)) end--;
  valid(end >= cutoff);
  const count = u16(end + 10);
  const directorySize = u32(end + 12);
  const directoryStart = u32(end + 16);
  valid(!u16(end + 4) && !u16(end + 6) && count === u16(end + 8), BAD_FORMAT);
  valid(count <= 4096, TOO_LARGE);
  valid(directoryStart + directorySize <= end);
  const entries = new Map();
  let total = 0;
  let offset = directoryStart;
  for (let i = 0; i < count; i++) {
    valid(offset + 46 <= end && u32(offset) === 0x02014b50);
    const flags = u16(offset + 8), method = u16(offset + 10);
    const packed = u32(offset + 20), size = u32(offset + 24);
    const nameLength = u16(offset + 28), extra = u16(offset + 30), comment = u16(offset + 32);
    const local = u32(offset + 42), crc = u32(offset + 16);
    const next = offset + 46 + nameLength + extra + comment;
    valid(next <= directoryStart + directorySize && local + 30 <= directoryStart);
    const name = utf8.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    valid(!name.startsWith("/") && !name.includes("\\") && !name.split("/").includes("..") && !entries.has(name));
    valid(!(flags & 1) && (method === 0 || method === 8), BAD_FORMAT);
    total += size;
    valid(size <= maxPart && total <= maxExpanded, TOO_LARGE);
    entries.set(name, { local, packed, size, crc, method });
    offset = next;
  }
  return name => {
    const entry = entries.get(name);
    valid(entry);
    const { local, packed, size, crc, method } = entry;
    valid(u32(local) === 0x04034b50 && u16(local + 8) === method);
    const start = local + 30 + u16(local + 26) + u16(local + 28);
    valid(start + packed <= directoryStart);
    const compressed = bytes.subarray(start, start + packed);
    let result;
    try {
      // One extra byte distinguishes a wrong declared size from an exact fit.
      result = method === 0 ? compressed : inflateSync(compressed, { out: new Uint8Array(size + 1) });
    } catch {
      throw new Error(BAD_ARCHIVE);
    }
    valid(result.length === size && crc32(result) === crc);
    return result;
  };
}

function pathInBook(raw, source = "") {
  if (!raw || /^(?:[a-z][\w+.-]*:|[/\\])|[\u0000-\u001f\\]/i.test(raw)) return null;
  const hashAt = raw.indexOf("#");
  const path = hashAt === -1 ? raw : raw.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : raw.slice(hashAt);
  if (!path) return source + hash;
  const segments = source ? source.split("/").slice(0, -1) : [];
  try {
    for (const part of path.split("/")) {
      const name = decodeURIComponent(part);
      if (!name || name === ".") continue;
      if (name === "..") {
        if (!segments.length) return null;
        segments.pop();
      } else {
        if (/[\u0000-\u001f/\\#:]/.test(name)) return null;
        segments.push(name);
      }
    }
  } catch {
    return null;
  }
  return segments.join("/") + hash;
}

function xml(bytes) {
  const text = utf8.decode(bytes);
  valid(!/<!ENTITY\s/i.test(text), BAD_FORMAT);
  // EPUB markup needs no external DTD. Keep only the XML tree we recreate ourselves.
  valid(!/<!DOCTYPE[^>]*\[/i.test(text), BAD_FORMAT);
  const parsed = new DOMParser().parseFromString(text.replace(/<!DOCTYPE\s+[^>]+>/i, ""), "application/xml");
  valid(!parsed.getElementsByTagNameNS("*", "parsererror").length);
  return parsed;
}

const elements = (node, name) => Array.from(node.getElementsByTagNameNS("*", name));
const compact = text => (text || "").replace(/\s+/g, " ").trim();
const fileOf = href => href.split("#")[0];
const tags = new Set(("article section header footer main aside nav div p blockquote h1 h2 h3 h4 h5 h6 " +
  "table caption thead tbody tfoot tr th td ul ol li dl dt dd pre code small br hr " +
  "figure figcaption span strong em b i u s sub sup ruby rt rp abbr q").split(" "));
const omitted = new Set(["script", "style", "link", "meta", "head", "base", "iframe", "frame",
  "object", "embed", "foreignobject", "audio", "video", "source", "noscript", "template"]);

function chapterNodes(body, context) {
  const { document: doc, href, onNavigate, anchors, spinePaths, imageUrl } = context;
  function copy(source) {
    if (source.nodeType === 3 || source.nodeType === 4) return doc.createTextNode(source.nodeValue);
    if (source.nodeType !== 1) return null;
    const tag = source.localName.toLowerCase();
    if (omitted.has(tag)) return null;
    let node;
    if (tag === "img" || tag === "image") {
      const raw = source.getAttribute("src") || source.getAttribute("href") ||
        source.getAttributeNS("http://www.w3.org/1999/xlink", "href");
      const path = pathInBook(raw, href);
      const url = path && imageUrl(path);
      if (!url) return null;
      node = doc.createElement("img");
      node.src = url;
      node.alt = source.getAttribute("alt") || "";
      node.decoding = "async";
    } else if (tag === "a") {
      const target = pathInBook(source.getAttribute("href"), href);
      if (target && spinePaths.has(fileOf(target))) {
        node = doc.createElement("a");
        node.href = "#";
        node.dataset.epubLink = target;
        node.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();
          onNavigate(target);
        });
      } else node = doc.createElement("span");
    } else {
      let safeTag = tags.has(tag) ? tag : "span";
      if (safeTag === "span" && source.classList.contains("bold")) safeTag = "strong";
      if (safeTag === "span" && source.classList.contains("italic")) safeTag = "em";
      node = doc.createElement(safeTag);
      if (safeTag === "td" || safeTag === "th") {
        for (const key of ["colspan", "rowspan"]) {
          const n = Number(source.getAttribute(key));
          if (n > 1 && n <= 100 && Number.isInteger(n)) node.setAttribute(key, String(n));
        }
      }
    }
    const id = source.getAttribute("id") || (tag === "a" && source.getAttribute("name"));
    if (id && !anchors.has(id)) {
      anchors.set(id, node);
      node.dataset.epubId = id;
    }
    for (const child of source.childNodes) {
      const safe = copy(child);
      if (safe) node.append(safe);
    }
    return node;
  }
  const content = doc.createDocumentFragment();
  for (const child of body.childNodes) {
    const safe = copy(child);
    if (safe) content.append(safe);
  }
  return content;
}

export async function openEpub(input) {
  const size = input?.size ?? input?.byteLength;
  valid(size > 0 && size <= maxArchive, size > maxArchive ? TOO_LARGE : BAD_ARCHIVE);
  const buf = input instanceof Blob ? await input.arrayBuffer() : input;
  const read = zipReader(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  const container = xml(read("META-INF/container.xml"));
  const opf = pathInBook(elements(container, "rootfile")[0]?.getAttribute("full-path"));
  valid(opf);
  const pkg = xml(read(opf));
  const metadata = elements(pkg, "metadata")[0], manifest = elements(pkg, "manifest")[0];
  const order = elements(pkg, "spine")[0];
  valid(metadata && manifest && order);
  const title = compact(elements(metadata, "title")[0]?.textContent);
  const declaredLanguage = compact(elements(metadata, "language")[0]?.textContent).toLowerCase().split(/[-_]/)[0];
  const machineAssisted = elements(metadata, "meta").some(meta =>
    meta.getAttribute("name") === "xiaomai:translation" && meta.getAttribute("content") === "machine-assisted-zh");
  valid(title);
  const assets = new Map(elements(manifest, "item").map(item => {
    const href = pathInBook(item.getAttribute("href"), opf);
    return [item.getAttribute("id"), { href, type: item.getAttribute("media-type"), props: item.getAttribute("properties") || "" }];
  }));
  const spine = elements(order, "itemref").map(item => {
    const asset = assets.get(item.getAttribute("idref"));
    valid(asset?.href && markupTypes.has(asset.type), BAD_FORMAT);
    return { href: asset.href, title: "" };
  });
  valid(spine.length);
  const spinePaths = new Set(spine.map(item => item.href));
  const toc = [];
  const tocAsset = assets.get(order.getAttribute("toc"));
  if (tocAsset?.href) {
    const ncx = xml(read(tocAsset.href));
    for (const item of elements(ncx, "navPoint")) {
      const href = pathInBook(elements(item, "content")[0]?.getAttribute("src"), tocAsset.href);
      const title = compact(elements(item, "navLabel")[0]?.textContent);
      if (href && spinePaths.has(fileOf(href)) && title) toc.push({ href, title });
    }
  } else {
    const nav = [...assets.values()].find(asset => asset.props.split(/\s+/).includes("nav"));
    if (nav?.href) {
      const allNav = elements(xml(read(nav.href)), "nav");
      const contents = allNav.find(el => el.getAttributeNS("http://www.idpf.org/2007/ops", "type") === "toc") || allNav[0];
      if (contents) for (const a of elements(contents, "a")) {
        const href = pathInBook(a.getAttribute("href"), nav.href);
        if (href && spinePaths.has(fileOf(href))) toc.push({ href, title: compact(a.textContent) });
      }
    }
  }
  const documents = new Map(), pictures = new Map(), objectUrls = new Map();
  let han = 0, latin = 0;
  for (const item of spine) {
    const bytes = read(item.href);
    const body = elements(xml(bytes), "body")[0];
    valid(body);
    const sample = body.textContent.slice(0, 3000);
    han += (sample.match(/[\u3400-\u9fff]/g) || []).length;
    latin += (sample.match(/[a-z]/gi) || []).length;
    const heading = elements(body, "h1")[0] || elements(body, "h2")[0];
    const fileTitle = toc.find(entry => entry.href === item.href)?.title;
    item.title = fileTitle || compact(heading?.textContent) ||
      compact(body.firstElementChild?.textContent).slice(0, 80) || (spine[0] === item ? "封面" : "插页");
    documents.set(item.href, bytes);
  }
  for (const asset of assets.values()) {
    if (asset.href && imageTypes.has(asset.type) && !pictures.has(asset.href)) {
      pictures.set(asset.href, new Blob([read(asset.href)], { type: asset.type }));
    }
  }
  return {
    title, declaredLanguage, machineAssisted,
    sampleLanguage: han >= 2 && han > latin * .15 ? "zh" : latin > 3 ? "en" : "",
    spine, toc: toc.length ? toc : spine,
    async render(target, element, onNavigate = () => {}) {
      const filename = fileOf(target);
      const bytes = documents.get(filename);
      valid(bytes, "这一页不在当前导入的书里。");
      const body = elements(xml(bytes), "body")[0];
      const anchors = new Map();
      function imageUrl(path) {
        if (!pictures.has(path)) return null;
        if (!objectUrls.has(path)) objectUrls.set(path, URL.createObjectURL(pictures.get(path)));
        return objectUrls.get(path);
      }
      const content = chapterNodes(body, { document: element.ownerDocument, href: filename, onNavigate, anchors, spinePaths, imageUrl });
      element.replaceChildren(content);
      let id = target.slice(filename.length + 1);
      try { id = decodeURIComponent(id); } catch { /* Some editions use a literal percent sign. */ }
      return { anchor: anchors.get(id) || null };
    },
    dispose() {
      documents.clear();
      pictures.clear();
      for (const url of objectUrls.values()) URL.revokeObjectURL(url);
      objectUrls.clear();
    },
  };
}

const storageError = "当前浏览器无法保存本机书稿。请检查可用空间和隐私模式。";

function storedBook(mode, operation) {
  return new Promise((resolve, reject) => {
    let failed = false;
    const fail = () => { failed = true; reject(new Error(storageError)); };
    let open;
    try { open = indexedDB.open("xiaomai-personal-reader", 1); } catch { return fail(); }
    open.onupgradeneeded = () => open.result.createObjectStore("books");
    open.onerror = open.onblocked = fail;
    open.onsuccess = () => {
      const db = open.result;
      if (failed) { db.close(); return; }
      let request, transaction;
      try {
        transaction = db.transaction("books", mode);
        request = operation(transaction.objectStore("books"));
      }
      catch { db.close(); fail(); return; }
      transaction.oncomplete = () => { db.close(); resolve(request.result ?? null); };
      transaction.onerror = transaction.onabort = () => { db.close(); fail(); };
    };
  });
}

function localBookKey(language) {
  if (language === "zh") return "montessori-baby-zh";
  if (language === "en") return "montessori-baby";
  throw new Error("此阅读器支持中文和英文。");
}
export const loadStoredEpub = (language = "en") => storedBook("readonly", store => store.get(localBookKey(language)));
export const saveStoredEpub = (blob, language = "en") => storedBook("readwrite", store => store.put(blob, localBookKey(language)));
export const removeStoredEpub = (language = "en") => storedBook("readwrite", store => store.delete(localBookKey(language)));
