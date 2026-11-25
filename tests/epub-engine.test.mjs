import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { createRequire } from "node:module";
import { openEpub } from "../epub-engine.js";

// A tiny original fixture built in memory, with both standard EPUB compression methods.
function makeZip(files) {
  const chunks = [], directory = [];
  let offset = 0;
  for (const [name, contents] of Object.entries(files)) {
    const source = Buffer.from(contents), path = Buffer.from(name);
    const deflate = name !== "mimetype";
    const data = deflate ? deflateRawSync(source) : source;
    let crc = -1;
    for (const byte of source) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(deflate ? 8 : 0, 8); header.writeUInt32LE((~crc) >>> 0, 14);
    header.writeUInt32LE(data.length, 18); header.writeUInt32LE(source.length, 22);
    header.writeUInt16LE(path.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4);
    header.copy(entry, 6, 4, 30); entry.writeUInt32LE(offset, 42);
    chunks.push(header, path, data); directory.push(entry, path);
    offset += header.length + path.length + data.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(directory.length / 2, 8);
  end.writeUInt16LE(directory.length / 2, 10); end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, central, end]);
}

test("导入空文件、非 EPUB 文件、损坏或超过大小上限的书稿时给出本机提示", async () => {
  await assert.rejects(openEpub(new Blob([])), /EPUB/);
  await assert.rejects(openEpub(new Blob(["other"])), /EPUB/);
  await assert.rejects(openEpub(makeZip({ mimetype: "application/epub+zip" })), /EPUB/);
  await assert.rejects(openEpub({ size: 512 * 1024 * 1024 }), /容量/);
});

const require = createRequire(import.meta.url);
let JSDOM;
try { ({ JSDOM } = require(process.env.JSDOM_PATH || "jsdom")); } catch { /* Optional browser DOM for this integration test. */ }

test("原书插图、表格与书内定位保留，外部资源不会装入阅读页", { skip: !JSDOM && "需安装 jsdom 或设置 JSDOM_PATH" }, async () => {
  const { window } = new JSDOM("<article></article>");
  const host = window.document.querySelector("article");
  globalThis.DOMParser = window.DOMParser;
  let book;
  try {
    const file = makeZip({
      mimetype: "application/epub+zip",
      "META-INF/container.xml": '<container><rootfile full-path="Book/content.opf"/></container>',
      "Book/content.opf": '<package><metadata><title>家庭观察手记</title><language>zh-CN</language>' +
        '<meta name="xiaomai:translation" content="machine-assisted-zh"/></metadata><manifest>' +
        '<item id="a" href="pages/a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="pages/b.xhtml" media-type="application/xhtml+xml"/>' +
        '<item id="img" href="art/pic.png" media-type="image/png"/><item id="toc" href="nav.ncx" media-type="application/x-dtbncx+xml"/>' +
        '</manifest><spine toc="toc"><itemref idref="a"/><itemref idref="b"/></spine></package>',
      "Book/nav.ncx": '<ncx><navMap><navPoint><navLabel><text>第二页</text></navLabel><content src="pages/b.xhtml#item"/></navPoint></navMap></ncx>',
      "Book/pages/a.xhtml": '<html><body><p>第一页</p><img src="../art/pic.png"/><a href="b.xhtml#item">下一节</a>' +
        '<link rel="stylesheet" href="https://example.invalid/style.css"/><img src="https://example.invalid/image.jpg"/>' +
        '<iframe src="about:blank"/><script type="text/plain">unused</script></body></html>',
      "Book/pages/b.xhtml": '<html><body><p id="item">第二页</p><table><tr><td colspan="2">观察记录</td></tr></table></body></html>',
      "Book/art/pic.png": Uint8Array.from([0x89, 0x50, 0x4e, 0x47]),
    });
    book = await openEpub(file);
    assert.equal(book.title, "家庭观察手记");
    assert.equal(book.declaredLanguage, "zh");
    assert.equal(book.sampleLanguage, "zh");
    assert.equal(book.machineAssisted, true);
    assert.equal(book.spine.length, 2);
    assert.deepEqual(book.toc, [{ href: "Book/pages/b.xhtml#item", title: "第二页" }]);
    let clicked;
    await book.render(book.spine[0].href, host, target => { clicked = target; });
    assert.equal(host.querySelectorAll("img").length, 1);
    assert.match(host.querySelector("img").src, /^blob:/);
    assert.equal(host.querySelector("iframe,script,style,link"), null);
    host.querySelector("[data-epub-link]").click();
    assert.equal(clicked, "Book/pages/b.xhtml#item");
    const { anchor } = await book.render(clicked, host);
    assert.equal(anchor.textContent, "第二页");
    assert.equal(host.querySelector("td").colSpan, 2);
  } finally {
    book?.dispose();
    delete globalThis.DOMParser;
    window.close();
  }
});
