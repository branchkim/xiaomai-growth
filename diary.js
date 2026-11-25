import { careStats } from "./care-trends.js";
import { localDay } from "./checkins.js";
import { validDay, lifeDay, asDataURL } from "./growth-store.js";
const styles = {
  journal: "杂志",
  instant: "拍立得",
  calendar: "日签",
  photo: "胶片",
  plain: "极简",
};
const verses = [
  "今天，也一起长大了一点。",
  "把这个小小的瞬间留给以后。",
  "慢慢来，我们陪着你。",
  "记住今天的模样。",
];
let connection;
function db() {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open("xiaomai-family-diary", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("days", { keyPath: "day" });
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = null;
        };
        resolve(request.result);
      };
      request.onerror = () =>
        reject(Error("无法打开本机相册，请检查浏览器存储权限。"));
    }).catch((e) => {
      connection = null;
      throw e;
    });
  return connection;
}
async function transact(mode, action) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction("days", mode),
      store = tx.objectStore("days");
    const req = action(store);
    tx.oncomplete = () => resolve(req?.result);
    tx.onabort = tx.onerror = () =>
      reject(tx.error || Error("未能保存照片，请检查可用空间。"));
  });
}
const getDay = (day) => transact("readonly", (store) => store.get(day));
async function jpg(file) {
  const image = await loadImage(file);
  const k = Math.min(
    1,
    1440 / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(image.naturalWidth * k));
  c.height = Math.max(1, Math.round(image.naturalHeight * k));
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(image, 0, 0, c.width, c.height);
  return canvasBlob(c, "image/jpeg", 0.81);
}
async function loadImage(blob) {
  const url = URL.createObjectURL(blob),
    img = new Image();
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(Error("照片无法读取，可以换一张 JPG 或 PNG。"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function canvasBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("生成图片失败。"))),
      type,
      quality,
    ),
  );
}
const put = (record) => transact("readwrite", (store) => store.put(record));
export const clearDiary = () => transact("readwrite", (s) => s.clear());
export async function exportDiary() {
  const result = await transact("readonly", (s) => s.getAll());
  return Promise.all(
    result.map(async (r) => ({
      ...r,
      photos: await Promise.all(r.photos.map(asDataURL)),
    })),
  );
}
export function validateDiaryBackup(rows = []) {
  const days = new Set();
  if (!Array.isArray(rows)) throw Error("照片日记备份格式不正确。");
  for (const r of rows) {
    if (
      !r ||
      !validDay(r.day) ||
      days.has(r.day) ||
      !Array.isArray(r.photos) ||
      !r.photos.every(
        (s) =>
          typeof s === "string" &&
          /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(s),
      ) ||
      typeof r.note !== "string" ||
      !Object.hasOwn(styles, r.style) ||
      !Number.isInteger(r.cover) ||
      r.cover < 0 ||
      r.cover >= Math.max(1, r.photos.length) ||
      !Number.isFinite(Date.parse(r.updated))
    )
      throw Error("照片日记备份格式不正确。");
    if (r.photos.some((s) => s.slice(s.indexOf(",") + 1).length % 4 !== 0))
      throw Error("日记照片备份不完整。");
    days.add(r.day);
  }
  return rows;
}
export async function importDiary(rows) {
  for (const row of validateDiaryBackup(rows)) {
    const existing = await getDay(row.day);
    if (existing && Date.parse(existing.updated) >= Date.parse(row.updated))
      continue;
    const photos = row.photos.map(
      (url) =>
        new Blob(
          [Uint8Array.from(atob(url.split(",")[1]), (c) => c.charCodeAt(0))],
          { type: "image/jpeg" },
        ),
    );
    await put({ ...row, photos });
  }
}
function fitText(g, text, width) {
  const lines = [];
  let line = "";
  for (const c of text) {
    if (c === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    if (line && g.measureText(line + c).width > width) {
      lines.push(line);
      line = "";
    }
    line += c;
  }
  lines.push(line);
  return lines;
}
async function coverImage(blob) {
  if (blob) return loadImage(blob);
  const img = new Image();
  img.src = "./assets/wheat-field.webp";
  return new Promise((resolve) => {
    if (img.complete) resolve(img);
    else img.onload = img.onerror = () => resolve(img);
  });
}

function coverCrop(g, image, x, y, w, h) {
  if (!image.naturalWidth || !image.naturalHeight) return;
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale, sh = h / scale;
  g.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function calendarPoster(g, source, r, profile, day, checkins) {
  const date = new Date(r.day + "T12:00:00");
  const number = String(day ?? date.getDate());
  const text = (value, x, y, font, color, width = 625) => {
    g.fillStyle = color;
    g.font = font;
    g.fillText(value, x, y, width);
  };
  g.fillStyle = "#faf7f0";
  g.fillRect(0, 0, 720, 920);
  text(date.getFullYear() + " 年  ·  " + (date.getMonth() + 1) + " 月  ·  星期" + "日一二三四五六"[date.getDay()], 42, 57, "600 20px sans-serif", "#736d62");
  g.textAlign = "right";
  text(day ? "NO." + number.padStart(3, "0") : (date.getMonth()+1) + " / " + number, 678, 57, "600 22px serif", "#736d62");
  g.textAlign = "left";
  g.fillStyle = "#d8d2c5";
  g.fillRect(42, 80, 636, 2);
  const x=325, y=128, w=353, h=460, radius=w/2;
  g.save();
  g.beginPath();
  g.moveTo(x, y+h);
  g.lineTo(x, y+radius);
  g.arc(x+radius, y+radius, radius, Math.PI, 2*Math.PI);
  g.lineTo(x+w, y+h);
  g.closePath();
  g.clip();
  coverCrop(g, source, x, y, w, h);
  g.restore();
  text(number, 40, 316, "186px Georgia, serif", "#332c23", 255);
  text(day ? "出 生 天 数" : (date.getMonth()+1) + " 月", 48, 370, "600 23px sans-serif", "#716751", 245);
  fitTextAfterFont(profile.name, "44px serif", 245).slice(0, 2)
    .forEach((line,i) => text(line, 48, 490+i*55, "44px serif", "#3d362a", 245));
  text("成 长 日 签", 48, 576, "18px sans-serif", "#8b806d", 230);
  const lines=fitTextAfterFont(r.note || verses[0], "32px serif", 625);
  lines.slice(0,2).forEach((line,i) => text(i===1 && lines.length>2 ? line.replace(/.$/u,"…") : line,44,658+i*45,"32px serif","#393229"));
  const data = careStats(checkins, 7, new Date(), date).rows.at(-1);
  const summary = [
    ["奶量", data.milk == null ? "—" : data.milk+" mL", "#eddbcb"],
    ["睡眠", data.sleep == null ? "—" : Math.round(data.sleep)+" 分钟", "#e4dfed"],
    ["便便", data.stool == null ? "—" : data.stool+" 次", "#dce7da"],
  ];
  summary.forEach(([label,val,bg],i) => {
    const left=44+i*215;
    g.fillStyle=bg;
    g.fillRect(left,758,5,63);
    text(val,left+14,785,"600 28px sans-serif","#393329",180);
    text(label,left+14,817,"20px sans-serif","#6d685d",180);
  });
  g.fillStyle="#d8d2c5";
  g.fillRect(42,852,636,1);
  text("小麦的成长计划",44,888,"18px sans-serif","#766e61");
  g.textAlign="right";
  text(r.day,677,888,"18px serif","#766e61");
  g.textAlign="left";
  function fitTextAfterFont(value, font, width) {
    g.font=font;
    return fitText(g,value,width);
  }
}

async function paint(canvas, r, profile, checkins) {
  const photo = await coverImage(r.photos[r.cover]);
  const width = 720,
    height = 920;
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d"),
    day = lifeDay(profile.birthday, r.day);
  if (r.style === "calendar") {
    calendarPoster(g, photo, r, profile, day, checkins);
    return;
  }
  const colors = {
    journal: ["#f5ecd7", "#342c21"],
    instant: ["#fff8ed", "#574840"],
    photo: ["#243b34", "#fffaf1"],
    plain: ["#f9f8f0", "#333c31"],
  };
  const [paper, ink] = colors[r.style];
  g.fillStyle = paper;
  g.fillRect(0, 0, width, height);
  const isPhoto = r.style === "photo",
    top = r.style === "instant" ? 30 : 115;
  const x = isPhoto ? 0 : 44,
    y = isPhoto ? 0 : top,
    w = width - 2 * x,
    h = isPhoto
      ? height
      : r.style === "plain"
        ? 340
        : r.style === "instant"
          ? 590
          : 424;
  coverCrop(g, photo, x, y, w, h);
  if (isPhoto) {
    const fade = g.createLinearGradient(0, 350, 0, 920);
    fade.addColorStop(0, "rgba(12,25,17,0)");
    fade.addColorStop(1, "rgba(12,25,17,.93)");
    g.fillStyle = fade;
    g.fillRect(0, 350, width, 570);
  }
  g.fillStyle = ink;
  g.textAlign = "left";
  const heading = day ? "出生第 " + day + " 天" : r.day;
  if (!isPhoto && r.style !== "instant") {
    g.font = "bold 50px serif";
    g.fillText(heading, 42, 76, 630);
  }
  const after = isPhoto ? 680 : y + h + 68;
  g.font = "bold 38px serif";
  g.fillText(
    r.style === "instant" || isPhoto ? heading : profile.name + "的成长日记",
    42,
    after,
    630,
  );
  g.font = "30px serif";
  const lines = fitText(g, r.note || verses[0], 630);
  const maxLines = Math.max(1, Math.floor((827 - after) / 39));
  lines
    .slice(0, maxLines)
    .forEach((line, i) =>
      g.fillText(
        i === maxLines - 1 && lines.length > maxLines
          ? line.slice(0, -1) + "…"
          : line,
        44,
        after + 55 + i * 39,
        632,
      ),
    );
  g.font = "24px sans-serif";
  g.fillText(profile.name + " · " + r.day, 44, 858, 630);
  const row = careStats(
    checkins,
    7,
    new Date(),
    new Date(r.day + "T12:00:00"),
  ).rows.at(-1);
  if (row.observed) {
    const values = [
      row.milk != null && "瓶喂 " + row.milk + " mL",
      row.sleep != null && "睡眠 " + Math.round(row.sleep) + " 分钟",
      row.stool != null && "便便 " + row.stool + " 次",
    ].filter(Boolean);
    if (!values.length && row.feeds) values.push("喂养 " + row.feeds + " 次");
    g.font = "20px sans-serif";
    g.fillText(values.join("　·　"), 44, 896, 632);
  }
}
export function mountDiary(root, ctx) {
  root.classList.add("quick-diary");
  root.innerHTML = `
    <header class="diary-top"><h2>照片日签</h2><div class="diary-capture">
      <button type="button" data-today hidden>写今天</button>
      <label class="file-btn">拍照<input type="file" accept="image/*" capture="environment" data-camera aria-label="拍照"></label>
      <label class="file-btn">选照片<input type="file" multiple accept="image/*" data-images aria-label="选照片"></label>
    </div></header>
    <div class="diary-byline"><strong data-caption></strong><span data-streak></span></div>
    <canvas width="720" height="920" class="daily-poster" aria-label="照片日签预览" role="img"></canvas>
    <div class="diary-styles" data-styles role="group" aria-label="日签样式"></div>
    <div class="diary-toolbar">
      <button type="button" data-verse>换一句</button>
      <button type="button" data-cover>换封面</button>
      <button type="button" data-share>分享日签</button>
    </div>
    <form class="growth-form" data-editor>
      <details class="diary-fold" data-diary-edit>
        <summary>编辑日记</summary>
        <label>记录日期<input type="date" data-day></label>
        <div data-week class="diary-week" aria-label="所选日期前七天"></div>
        <label>写一句今天的事<textarea maxlength="1000" rows="3" data-note placeholder="今天发生了什么？"></textarea></label>
        <button type="button" data-remove hidden>删除这天日记</button>
      </details>
      <details class="diary-fold" data-covers hidden>
        <summary>封面相册</summary>
        <div class="diary-thumbs" data-thumbs></div>
      </details>
      <div class="diary-save" data-save hidden><button class="solid" type="submit">保存日记</button></div>
      <p class="muted" data-state role="status"></p>
    </form>
    <details class="diary-fold"><summary>以前的日记</summary><div class="diary-history" data-history></div></details>`;
  const q = (s) => root.querySelector(s),
    picker = q("[data-day]"),
    note = q("[data-note]"),
    status = q("[data-state]");
  for (const [id,label] of Object.entries(styles)) {
    const b=document.createElement("button");
    b.type="button"; b.dataset.diaryStyle=id; b.textContent=label;
    b.onclick=()=>{
      if (!record || record.style===id) return;
      record.style=id;
      updateStyles();
      changed();
    };
    q("[data-styles]").append(b);
  }
  function updateStyles() {
    for (const b of q("[data-styles]").children)
      b.setAttribute("aria-pressed", String(b.dataset.diaryStyle===record.style));
  }
  picker.value = picker.max = localDay();
  let record,
    savedStamp,
    pending = false,
    generation = 0,
    paintId = 0,
    verse = 0,
    revision = 0,
    importing = false;
  function changed() {
    pending = true;
    revision++;
    q("[data-save]").hidden = false;
    status.textContent = "尚未保存";
    draw();
  }
  function draw() {
    const id = ++paintId;
    const offscreen = document.createElement("canvas");
    return paint(offscreen, record, ctx.profile(), ctx.checkins)
      .then(() => {
        if (id !== paintId || !root.isConnected) return;
        const c = q("canvas");
        if (!c) return;
        c.width = offscreen.width;
        c.height = offscreen.height;
        c.getContext("2d").drawImage(offscreen, 0, 0);
      })
      .catch((e) => {
        status.textContent = e.message;
      });
  }
  function thumbnails() {
    const list = q("[data-thumbs]");
    list.replaceChildren();
    q("[data-covers]").hidden = !record.photos.length;
    record.photos.forEach((blob, i) => {
      const wrap = document.createElement("span"),
        b = document.createElement("button"),
        pic = new Image(),
        del = document.createElement("button");
      const url = URL.createObjectURL(blob);
      pic.onload = pic.onerror = () => URL.revokeObjectURL(url);
      pic.src = url;
      pic.alt = "";
      b.type = del.type = "button";
      b.append(pic);
      b.setAttribute("aria-label", "选第 " + (i + 1) + " 张作封面");
      b.setAttribute("aria-pressed", String(i === record.cover));
      b.onclick = () => {
        record.cover = i;
        changed();
        thumbnails();
      };
      del.textContent = "移除";
      del.onclick = () => {
        record.photos.splice(i, 1);
        if (i < record.cover) record.cover--;
        record.cover = Math.max(
          0,
          Math.min(record.cover, record.photos.length - 1),
        );
        changed();
        thumbnails();
      };
      wrap.append(b, del);
      list.append(wrap);
    });
  }
  async function history() {
    const days = (await transact("readonly", (s) => s.getAllKeys()))
      .sort()
      .reverse();
    const dest = q("[data-history]");
    if (!dest) return;
    const known = new Set(days);
    let endDate = new Date();
    endDate.setHours(12, 0, 0, 0);
    if (!known.has(localDay(endDate))) endDate.setDate(endDate.getDate() - 1);
    let count = 0;
    while (known.has(localDay(endDate))) {
      count++;
      endDate.setDate(endDate.getDate() - 1);
    }
    q("[data-streak]").textContent =
      "已写 " +
      days.length +
      " 篇" +
      (count ? " · 最近连续 " + count + " 天" : "");
    const week = q("[data-week]");
    week.replaceChildren();
    for (let i = -6; i <= 0; i++) {
      const when = new Date(picker.value + "T12:00:00");
      when.setDate(when.getDate() + i);
      const day = localDay(when),
        b = document.createElement("button");
      b.type = "button";
      b.textContent = when.getMonth() + 1 + "/" + when.getDate();
      b.setAttribute(
        "aria-label",
        day + (known.has(day) ? " 已记录" : " 无日记"),
      );
      if (known.has(day)) b.className = "has-diary";
      if (!i) b.setAttribute("aria-current", "date");
      b.onclick = () => {
        picker.value = day;
        changeDay();
      };
      week.append(b);
    }
    dest.replaceChildren(
      ...days.map((d) => {
        const b = document.createElement("button");
        b.textContent = d;
        b.onclick = () => {
          picker.value = d;
          changeDay();
        };
        return b;
      }),
    );
    if (!days.length) dest.textContent = "还没有已保存的日记。";
  }
  async function load(day) {
    const token = ++generation;
    try {
      const existing = await getDay(day);
      if (token !== generation || !root.isConnected) return;
      picker.value = day;
      savedStamp = existing?.updated;
      record = existing || {
        day,
        note: "",
        photos: [],
        cover: 0,
        style: "calendar",
      };
      note.value = record.note;
      updateStyles();
      q("[data-today]").hidden = day === localDay();
      const selectedDate = new Date(day+"T12:00:00");
      q("[data-caption]").textContent = (day===localDay() ? "今天" : "日记") + " · " +
        (selectedDate.getMonth()+1) + " 月 " + selectedDate.getDate() + " 日";
      q("[data-save]").hidden = true;
      q("[data-covers]").open = false;
      pending = false;
      revision++;
      status.textContent = "";
      q("[data-remove]").hidden = !existing;
      thumbnails();
      await draw();
      await history();
    } catch (e) {
      status.textContent = e.message;
      q("[data-editor] button[type=submit]").disabled = true;
    }
  }
  function changeDay() {
    if (importing || (pending && !confirm("放弃这一天尚未保存的修改？"))) {
      picker.value = record.day;
      return;
    }
    const day = picker.value;
    if (!validDay(day) || day > localDay()) {
      picker.value = record?.day || localDay();
      return;
    }
    load(day);
  }
  picker.onchange = changeDay;
  note.oninput = () => {
    if (record) {
      record.note = note.value;
      changed();
    }
  };
  q("[data-today]").onclick = () => {
    picker.value = localDay();
    changeDay();
  };
  q("[data-cover]").onclick = () => {
    if (!record) return;
    if (record.photos.length < 2) { q("[data-images]").click(); return; }
    const covers = q("[data-covers]");
    covers.open = true;
    covers.scrollIntoView({block:"nearest"});
    covers.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});
  };
  q("[data-verse]").onclick = () => {
    if (record) {
      const index = verses.indexOf(record.note || verses[0]);
      verse = index >= 0 ? (index + 1) % verses.length : (verse + 1) % verses.length;
      record.note = note.value = verses[verse];
      changed();
    }
  };
  async function addImages(e) {
    if (!record || importing) return;
    importing = true;
    const target = record,
      files = [...e.target.files];
    try {
      const images = [];
      for (const file of files) images.push(await jpg(file));
      target.photos.push(...images);
      if (images.length) target.cover = target.photos.length - images.length;
      changed();
      thumbnails();
    } catch (err) {
      status.textContent = err.message;
    } finally {
      e.target.value = "";
      importing = false;
    }
  }
  q("[data-images]").onchange = q("[data-camera]").onchange = addImages;
  q("[data-editor]").onsubmit = async (e) => {
    e.preventDefault();
    if (!record || importing) return;
    if (!record.note.trim() && !record.photos.length) {
      status.textContent = "请选照片或写下一句话。";
      return;
    }
    const draft = {
        ...record,
        photos: record.photos.slice(),
        updated: new Date().toISOString(),
      },
      rev = revision,
      day = record.day;
    try {
      const database = await db();
      await new Promise((resolve, reject) => {
        const tx = database.transaction("days", "readwrite"),
          s = tx.objectStore("days"),
          cur = s.get(day);
        let conflict = false;
        cur.onsuccess = () => {
          if (cur.result?.updated !== savedStamp) {
            conflict = true;
            tx.abort();
          } else s.put(draft);
        };
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () =>
          reject(
            Error(
              conflict
                ? "另一个页面已更新这天日记，请重新打开核对。"
                : "保存失败，请检查设备剩余空间。",
            ),
          );
      });
      if (record.day === day) {
        savedStamp = draft.updated;
        if (rev === revision) {
          pending = false;
          q("[data-save]").hidden = true;
          status.textContent = "已保存到本机";
        }
        q("[data-remove]").hidden = false;
      }
      await history();
    } catch (err) {
      status.textContent = err.message;
    }
  };
  q("[data-remove]").onclick = async () => {
    if (!record || !confirm("删除这一天的文字和照片？")) return;
    try {
      await transact("readwrite", (s) => s.delete(record.day));
      await load(record.day);
    } catch (e) {
      status.textContent = e.message;
    }
  };
  q("[data-share]").onclick = async () => {
    if (!record || importing) return;
    try {
      const c = document.createElement("canvas");
      await paint(c, record, ctx.profile(), ctx.checkins);
      const blob = await canvasBlob(c),
        name = "小麦日签-" + record.day + ".png";
      if (window.xiaomaiNative?.shareFile) await ctx.saveFile(blob, name);
      else {
        const dlg = document.createElement("dialog"),
          wrap = document.createElement("div"),
          pic = new Image(),
          hint = document.createElement("p"),
          actions = document.createElement("div"),
          save = document.createElement("button"),
          close = document.createElement("button");
        const url = URL.createObjectURL(blob);
        pic.src = url;
        pic.alt = "可保存的照片日签";
        pic.className = "share-poster";
        wrap.className = "dialog-body";
        actions.className = "growth-actions";
        hint.textContent = "长按图片可保存到相册，再发给家人。";
        save.textContent = "保存图片";
        close.textContent = "关闭";
        close.onclick = () => dlg.close();
        save.onclick = () =>
          ctx.saveFile(blob, name).catch((e) => {
            hint.textContent = e.message;
          });
        actions.append(save);
        const file = new File([blob], name, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          const share = document.createElement("button");
          share.textContent = "系统分享";
          share.onclick = () =>
            navigator.share({ files: [file] }).catch((e) => {
              if (e.name !== "AbortError")
                hint.textContent = "可以长按图片保存后分享。";
            });
          actions.append(share);
        }
        actions.append(close);
        wrap.append(hint, pic, actions);
        dlg.append(wrap);
        dlg.setAttribute("aria-label", "分享照片日签");
        document.body.append(dlg);
        dlg.onclose = () => {
          URL.revokeObjectURL(url);
          dlg.remove();
        };
        dlg.showModal();
      }
      status.textContent = "日签已生成";
    } catch (e) {
      if (e.name !== "AbortError") status.textContent = e.message;
    }
  };
  // Start with the newest saved day. This key cursor avoids loading old photos.
  transact("readonly", (s) => s.openKeyCursor(null,"prev")).then((cursor) => {
    if (root.isConnected && !generation) load(cursor?.key || localDay());
  }).catch((e) => { status.textContent=e.message; });
}
