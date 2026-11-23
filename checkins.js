const prefix = "xiaomai/checkins/v1/";
const kinds = new Set(["task", "feed", "sleep", "diaper"]);

export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function isStamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function readCheckinBackup(items = []) {
  if (!Array.isArray(items)) throw new Error("打卡备份格式有误。");
  const ids = new Set();
  for (const item of items) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[a-z0-9-]{8,64}$/i.test(item.id) ||
      ids.has(item.id) ||
      !kinds.has(item.kind) ||
      typeof item.day !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.day) ||
      !isStamp(item.created) ||
      !isStamp(item.updated) ||
      !(item.done === null || isStamp(item.done)) ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      item.title.length > 100
    ) {
      throw new Error("打卡备份格式有误，请检查文件。");
    }
    ids.add(item.id);
  }
  return items;
}

export class Checkins {
  constructor(storage) {
    this.storage = storage;
    this.items = new Map();
    this.pending = new Set();
    this.read();
  }

  read() {
    if (!this.storage) return;
    const saved = new Map();
    try {
      for (let n = 0; n < this.storage.length; n++) {
        const key = this.storage.key(n);
        if (!key?.startsWith(prefix)) continue;
        try {
          const [item] = readCheckinBackup([
            JSON.parse(this.storage.getItem(key)),
          ]);
          if (key === prefix + item.id) saved.set(item.id, item);
        } catch {
          /* Keep other records readable if one key is damaged. */
        }
      }
    } catch {
      return;
    }
    for (const id of this.pending) {
      if (this.items.has(id)) saved.set(id, this.items.get(id));
      else saved.delete(id);
    }
    this.items = saved;
  }

  write(id, item) {
    if (item) this.items.set(id, item);
    else this.items.delete(id);
    try {
      if (!this.storage) throw new Error("storage");
      if (item) this.storage.setItem(prefix + id, JSON.stringify(item));
      else this.storage.removeItem(prefix + id);
      this.pending.delete(id);
      return true;
    } catch {
      this.pending.add(id);
      return false;
    }
  }

  add(kind, title, now = new Date()) {
    const stamp = now.toISOString();
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    const [item] = readCheckinBackup([
      {
        id,
        kind,
        title: title.trim(),
        day: localDay(now),
        created: stamp,
        updated: stamp,
        done: kind === "task" ? null : stamp,
      },
    ]);
    return this.write(id, item);
  }

  toggle(id, checked) {
    this.read();
    const item = this.items.get(id);
    if (!item || item.kind !== "task") return true;
    const stamp = new Date().toISOString();
    return this.write(id, {
      ...item,
      updated: stamp,
      done: checked ? stamp : null,
    });
  }

  merge(items) {
    this.read();
    let durable = true;
    for (const item of items) {
      const existing = this.items.get(item.id);
      if (
        !existing ||
        Date.parse(item.updated) > Date.parse(existing.updated)
      ) {
        if (!this.write(item.id, item)) durable = false;
      }
    }
    return durable;
  }

  backup() {
    this.read();
    return [...this.items.values()];
  }
}

export function setupCheckins(store) {
  const $ = (id) => document.getElementById(id);
  const date = $("checkin-day"),
    title = $("new-task");
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const byCreated = (a, b) => a.created.localeCompare(b.created);
  let today = localDay();
  date.value = today;

  function saved(durable, message) {
    $("checkin-status").textContent = durable
      ? message
      : "设备未能保存，本页仍可查看，请在「安装与备份」导出。";
    render();
  }

  function row(item, historical) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    if (item.kind === "task") {
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = Boolean(item.done);
      box.disabled = historical;
      box.onchange = () => {
        saved(
          store.toggle(item.id, box.checked),
          box.checked ? "已完成" : "已恢复为待办",
        );
        $("checkin-tasks")
          .querySelector('[data-id="' + item.id + '"] input')
          ?.focus({ preventScroll: true });
      };
      label.append(box);
    }
    const caption = document.createElement("span");
    caption.textContent = item.title;
    label.append(caption);
    li.dataset.id = item.id;
    li.classList.toggle("checked", Boolean(item.done) && item.kind === "task");
    li.append(label);
    if (item.done) {
      const stamp = document.createElement("time");
      stamp.dateTime = item.done;
      stamp.textContent = time.format(new Date(item.done));
      li.append(stamp);
    }
    if (!historical) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-checkin";
      remove.textContent = "移除";
      remove.setAttribute("aria-label", "移除" + item.title);
      remove.onclick = () => {
        if (window.confirm("移除「" + item.title + "」？"))
          saved(store.write(item.id, null), "已移除");
      };
      li.append(remove);
    }
    return li;
  }

  function render() {
    const currentDay = localDay();
    if (!date.value || date.value === today || date.value > currentDay)
      date.value = currentDay;
    today = currentDay;
    date.max = today;
    const historical = date.value !== today;
    $("checkin-title").textContent = historical ? "当日打卡" : "今日打卡";
    $("checkin-today").hidden = !historical;
    $("checkin-controls").hidden = historical;
    const items = [...store.items.values()]
      .filter((item) => item.day === date.value)
      .sort(byCreated);
    const tasks = items.filter((item) => item.kind === "task");
    const logs = items.filter((item) => item.kind !== "task").reverse();
    $("checkin-tasks").replaceChildren(
      ...tasks.map((item) => row(item, historical)),
    );
    $("checkin-logs").replaceChildren(
      ...logs.map((item) => row(item, historical)),
    );
    $("log-history").hidden = !logs.length;
    $("log-count").textContent = "查看照护记录（" + logs.length + "）";
    $("task-count").textContent = tasks.length
      ? "待办已完成 " +
        tasks.filter((item) => item.done).length +
        " / " +
        tasks.length
      : historical && !logs.length
        ? "这一天还没有打卡记录"
        : "";
  }

  $("task-form").onsubmit = (e) => {
    e.preventDefault();
    if (!title.value.trim()) {
      title.focus();
      return;
    }
    const durable = store.add("task", title.value);
    title.value = "";
    date.value = localDay();
    saved(durable, "已添加待办");
  };
  for (const btn of $("quick-checkins").querySelectorAll("button")) {
    btn.onclick = () => {
      const durable = store.add(btn.dataset.kind, btn.dataset.title);
      date.value = localDay();
      $("log-history").open = true;
      saved(durable, "已记" + btn.dataset.title);
    };
  }
  date.onchange = () => {
    $("checkin-status").textContent = "";
    render();
  };
  $("checkin-today").onclick = () => {
    date.value = localDay();
    $("checkin-status").textContent = "";
    render();
  };
  function refresh() {
    store.read();
    render();
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener("pageshow", refresh);
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.startsWith(prefix)) refresh();
  });
  // Keep a page left open across local midnight on the correct day.
  setInterval(() => {
    if (localDay() !== today) render();
  }, 30000);
  render();
  return refresh;
}
