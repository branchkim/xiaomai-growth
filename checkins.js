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

function validDetails(item) {
  if (
    item.caregiver != null &&
    (typeof item.caregiver !== "string" || item.caregiver.length > 100)
  )
    return false;
  if (
    "feedType" in item &&
    (item.kind !== "feed" || !["bottle", "breast"].includes(item.feedType))
  )
    return false;
  if (
    item.amountMl != null &&
    (item.kind !== "feed" ||
      item.feedType !== "bottle" ||
      !Number.isSafeInteger(item.amountMl) ||
      item.amountMl <= 0)
  )
    return false;
  if (
    "diaperType" in item &&
    (item.kind !== "diaper" ||
      !["wet", "dirty", "mixed"].includes(item.diaperType))
  )
    return false;
  if (
    "sleepEnd" in item &&
    (item.kind !== "sleep" ||
      !(
        item.sleepEnd === null ||
        (isStamp(item.sleepEnd) &&
          Date.parse(item.sleepEnd) > Date.parse(item.created))
      ))
  )
    return false;
  return true;
}

function bridge() {
  return globalThis.window?.xiaomaiNative;
}

function changed() {
  globalThis.window?.dispatchEvent(new Event("xiaomai-care-change"));
}

function randomId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
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
      item.title.length > 100 ||
      !validDetails(item)
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
    this.nativeIds = new Set();
    this.read();
  }

  read() {
    const saved = this.storage ? new Map() : new Map(this.items);
    for (const id of this.nativeIds) saved.delete(id);
    try {
      for (let n = 0; n < (this.storage?.length ?? 0); n++) {
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
      for (const [id, item] of this.items)
        if (!this.nativeIds.has(id)) saved.set(id, item);
    }
    for (const id of this.pending) {
      if (this.items.has(id)) saved.set(id, this.items.get(id));
      else saved.delete(id);
    }
    this.nativeIds.clear();
    for (const item of bridge()?.careEntries ?? []) {
      try {
        readCheckinBackup([item]);
        this.nativeIds.add(item.id);
        saved.set(item.id, item);
      } catch {
        /* Other native records still load. */
      }
    }
    this.items = saved;
  }

  write(id, item, announce = true) {
    if (this.nativeIds.has(id)) throw new Error("请重新打开这条 App 记录。");
    if (item) this.items.set(id, item);
    else this.items.delete(id);
    try {
      if (!this.storage) throw new Error("storage");
      if (item) this.storage.setItem(prefix + id, JSON.stringify(item));
      else this.storage.removeItem(prefix + id);
      this.pending.delete(id);
    } catch {
      this.pending.add(id);
    }
    if (announce) changed();
    return !this.pending.has(id);
  }

  add(kind, title, now = new Date()) {
    const stamp = now.toISOString();
    const id = randomId();
    const [item] = readCheckinBackup([
      {
        id,
        kind,
        ...this.signature(),
        title: title.trim(),
        day: localDay(now),
        created: stamp,
        updated: stamp,
        done: kind === "task" ? null : stamp,
      },
    ]);
    return this.write(id, item);
  }

  signature() {
    const name = (this.profile?.()?.caregiver ?? "").trim().slice(0, 100);
    return name ? { caregiver: name } : {};
  }

  saveCare(kind, start, details, original, now = new Date()) {
    this.read();
    if (original && this.items.get(original.id)?.updated !== original.updated) {
      throw new Error("这条记录已更新，请重新打开。");
    }
    if (!(start instanceof Date) || !Number.isFinite(+start) || start > now)
      throw new Error("记录时间应早于或等于现在。");
    const created = start.toISOString();
    const titles = { feed: "喂养", sleep: "入睡", diaper: "换尿布" };
    if (!Object.hasOwn(titles, kind)) throw new Error("请选择照护类型。");
    const item = {
      id: original?.id ?? randomId(),
      kind,
      title: titles[kind],
      created,
      done: created,
      updated: new Date(
        Math.max(+now, (Date.parse(original?.updated) || 0) + 1),
      ).toISOString(),
      day: localDay(start),
      ...(original ? { caregiver: original.caregiver } : this.signature()),
      ...details,
    };
    if (
      item.sleepEnd != null &&
      (!isStamp(item.sleepEnd) ||
        Date.parse(item.sleepEnd) <= +start ||
        Date.parse(item.sleepEnd) > +now)
    )
      throw new Error("醒来时间须晚于入睡，且不能晚于现在。");
    if (kind === "sleep" && "sleepEnd" in item) {
      const end = item.sleepEnd ? Date.parse(item.sleepEnd) : Infinity;
      for (const other of this.items.values()) {
        if (
          other.id !== item.id &&
          other.kind === "sleep" &&
          "sleepEnd" in other &&
          +start < (other.sleepEnd ? Date.parse(other.sleepEnd) : Infinity) &&
          Date.parse(other.created) < end
        )
          throw new Error("这段时间已有睡眠记录，请检查入睡与醒来时间。");
      }
    }
    readCheckinBackup([item]);
    return this.write(item.id, item);
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
    for (const item of readCheckinBackup(items)) {
      if (this.nativeIds.has(item.id)) continue;
      const existing = this.items.get(item.id);
      if (
        !existing ||
        Date.parse(item.updated) > Date.parse(existing.updated) ||
        (this.pending.has(item.id) && item.updated === existing.updated)
      ) {
        if (!this.write(item.id, item, false)) durable = false;
      }
    }
    changed();
    return durable;
  }

  clearLocalCopy(id) {
    try {
      if (this.storage?.getItem(prefix + id) != null)
        this.storage.removeItem(prefix + id);
      this.pending.delete(id);
      if (!this.nativeIds.has(id)) this.items.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  async importBackup(items) {
    readCheckinBackup(items);
    if (!bridge()?.mergeCare || !items.length) return this.merge(items);
    this.read();
    const newest = items.map((item) => {
      const existing = this.items.get(item.id);
      return existing && Date.parse(existing.updated) > Date.parse(item.updated)
        ? existing
        : item;
    });
    const result = await bridge().mergeCare(newest);
    if (!Array.isArray(result?.accepted) || !Array.isArray(result?.skipped))
      throw new Error("App 未确认导入结果，请保留备份后重试。");
    const accepted = new Set(result.accepted);
    const skipped = new Set(result.skipped);
    if (newest.some((item) => !accepted.has(item.id) && !skipped.has(item.id)))
      throw new Error("部分记录尚未确认导入，请保留备份后重试。");
    let durable = true;
    for (const id of accepted) if (!this.clearLocalCopy(id)) durable = false;
    const remaining = newest.filter((item) => skipped.has(item.id));
    if (!this.merge(remaining)) durable = false;
    if (
      remaining.some(
        (item) =>
          this.nativeIds.has(item.id) &&
          Date.parse(item.updated) >
            Date.parse(this.items.get(item.id).updated),
      )
    )
      throw new Error("部分记录与 App 中的同编号记录冲突，请保留备份并核对。");
    return durable;
  }

  backup() {
    this.read();
    return [...this.items.values()];
  }
}

const clock = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function localMinute(date) {
  return (
    localDay(date) +
    "T" +
    [date.getHours(), date.getMinutes()]
      .map((n) => String(n).padStart(2, "0"))
      .join(":")
  );
}
export function careTime(value) {
  const date = new Date(value);
  return date.getMonth() + 1 + "/" + date.getDate() + " " + clock.format(date);
}
export function careDescription(item) {
  return careAction(item) + (item.caregiver ? " · " + item.caregiver : "");
}
function careAction(item) {
  if (item.kind === "feed") {
    if (item.feedType === "breast") return "亲喂";
    if (item.feedType === "bottle")
      return item.amountMl
        ? "瓶喂 " + item.amountMl + " mL"
        : "瓶喂（未记奶量）";
    return "喂养（仅记时间）";
  }
  if (item.kind === "diaper") {
    return (
      { wet: "尿布 · 小便", dirty: "尿布 · 大便", mixed: "尿布 · 大小便" }[
        item.diaperType
      ] ?? "换尿布（未分类）"
    );
  }
  if (item.sleepEnd) return "入睡 → " + careTime(item.sleepEnd) + " 醒来";
  return item.sleepEnd === null ? "入睡（进行中）" : "入睡（仅记时间）";
}

function button(text, className) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = text;
  return node;
}

// The form stays mounted while typing, independently of summary refreshes.
export function openCareEditor(
  store,
  { kind = "feed", day = localDay(), item, finish = false, onSave } = {},
) {
  const host = bridge();
  const profile = store.profile?.() ?? {};
  const defaults = {
    caregiver: profile.caregiver ?? "",
    feeding: profile.feeding ?? "",
    amount: profile.amount ?? "",
  };
  if (item && store.nativeIds.has(item.id) && host?.openCare)
    return host.openCare({
      ...defaults,
      kind: item.kind,
      id: item.id,
      day,
      finish,
    });
  const nativeAdd = !item && host?.openCare;
  const dialog = document.createElement("dialog");
  dialog.className = "care-editor";
  dialog.setAttribute("aria-labelledby", "care-editor-title");
  dialog.innerHTML = `
    <form class="dialog-body care-form">
      <div class="dialog-top"><h2 id="care-editor-title"></h2><button type="button" class="quiet" data-close>取消</button></div>
      <label>照护类型<select name="kind"><option value="feed">喂养</option><option value="sleep">睡眠</option><option value="diaper">尿布</option></select></label>
      <div data-fields>
        <label><span data-start-label>记录时间</span><input type="datetime-local" name="start" required></label>
        <label data-field="feed">喂养方式<select name="feedType"><option value="bottle">瓶喂</option><option value="breast">亲喂</option><option value="">仅记时间</option></select></label>
        <label data-field="amount">奶量（mL，可留空）<input inputmode="numeric" type="number" min="1" step="1" name="amount" placeholder="例如 90"></label>
        <label data-field="diaper">尿布情况<select name="diaperType"><option value="wet">小便</option><option value="dirty">大便</option><option value="mixed">大小便都有</option><option value="">未分类</option></select></label>
        <label data-field="sleep">睡眠状态<select name="sleepState"><option value="running">还在睡</option><option value="ended">已经醒来</option><option value="point">仅记入睡时间</option></select></label>
        <label data-field="end">醒来时间<input type="datetime-local" name="end"></label>
        <label>照护人（可留空）<input type="text" name="caregiver" maxlength="100" autocomplete="off"></label>
      </div>
      <p class="care-error" role="alert"></p>
      <button class="solid" type="submit"></button>
    </form>`;
  const form = dialog.querySelector("form"),
    fields = form.elements;
  const input = (name) => fields.namedItem(name);
  const now = new Date();
  const startText = localMinute(item ? new Date(item.created) : now);
  input("kind").value = item?.kind ?? kind;
  input("kind").disabled = Boolean(item);
  input("start").value = item ? startText : day + startText.slice(10);
  input("start").max = input("end").max = localMinute(now);
  input("end").value = localMinute(
    item?.sleepEnd ? new Date(item.sleepEnd) : now,
  );
  input("feedType").value = item
    ? (item.feedType ?? "")
    : profile.feeding === "mixed"
      ? ""
      : profile.feeding === "breast"
        ? "breast"
        : "bottle";
  input("amount").value = item ? (item.amountMl ?? "") : (profile.amount ?? "");
  input("caregiver").value = item
    ? (item.caregiver ?? "")
    : (profile.caregiver ?? "");
  input("diaperType").value = item ? (item.diaperType ?? "") : "wet";
  input("sleepState").value =
    finish || item?.sleepEnd
      ? "ended"
      : item && item.sleepEnd === undefined
        ? "point"
        : "running";
  dialog.querySelector("h2").textContent = item
    ? "编辑照护记录"
    : "详细记录 / 补记";
  const submit = form.querySelector("button[type=submit]");
  submit.textContent = nativeAdd ? "继续填写" : "保存记录";
  dialog.querySelector("[data-fields]").hidden = Boolean(nativeAdd);
  const show = (field, visible) => {
    const label = dialog.querySelector('[data-field="' + field + '"]');
    label.hidden = !visible;
    label.querySelector("input, select").disabled =
      !visible || Boolean(nativeAdd);
  };
  function sync() {
    const type = input("kind").value;
    show("feed", type === "feed");
    show("amount", type === "feed" && input("feedType").value === "bottle");
    show("diaper", type === "diaper");
    show("sleep", type === "sleep");
    show("end", type === "sleep" && input("sleepState").value === "ended");
    input("start").disabled = Boolean(nativeAdd);
    input("end").required = !input("end").disabled;
    dialog.querySelector("[data-start-label]").textContent =
      type === "sleep" ? "入睡时间" : "记录时间";
  }
  form.onchange = sync;
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.onclose = () => dialog.remove();
  form.onsubmit = async (event) => {
    event.preventDefault();
    const type = input("kind").value;
    const details = {};
    try {
      if (nativeAdd) {
        await host.openCare({ ...defaults, kind: type, day });
        dialog.close();
        return;
      }
      // Keep the seconds of an existing entry when the user did not change its time.
      const start = new Date(
        item && input("start").value === startText
          ? item.created
          : input("start").value,
      );
      if (type === "feed" && input("feedType").value) {
        details.feedType = input("feedType").value;
        if (details.feedType === "bottle" && input("amount").value !== "") {
          details.amountMl = input("amount").valueAsNumber;
          if (!Number.isSafeInteger(details.amountMl) || details.amountMl <= 0)
            throw new Error("奶量请填正整数，或留空。");
        }
      }
      if (type === "diaper" && input("diaperType").value)
        details.diaperType = input("diaperType").value;
      if (type === "sleep" && input("sleepState").value === "running")
        details.sleepEnd = null;
      if (type === "sleep" && input("sleepState").value === "ended") {
        const selectedEnd = input("end").value;
        const end =
          item?.sleepEnd &&
          input("end").value === localMinute(new Date(item.sleepEnd))
            ? new Date(item.sleepEnd)
            : item?.sleepEnd === null && selectedEnd === localMinute(new Date())
              ? new Date()
              : new Date(selectedEnd);
        if (!Number.isFinite(+end)) throw new Error("请选择醒来时间。");
        details.sleepEnd = end.toISOString();
      }
      details.caregiver = input("caregiver").value.trim();
      const durable = store.saveCare(type, start, details, item);
      dialog.close();
      onSave?.(durable, localDay(start));
    } catch (error) {
      dialog.querySelector(".care-error").textContent =
        error.message || "记录未能保存，请重试。";
    }
  };
  document.body.append(dialog);
  sync();
  dialog.showModal();
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
  const byCreated = (a, b) => Date.parse(a.created) - Date.parse(b.created);
  const actionBar = document.createElement("div");
  actionBar.className = "care-action-bar";
  const detail = button("详细记录 / 补记", "care-detail-button");
  const wake = button("结束睡眠", "care-detail-button");
  wake.hidden = true;
  actionBar.append(detail, wake);
  $("checkin-controls").after(actionBar);
  const activeSleep = () =>
    [...store.items.values()].find(
      (i) => i.kind === "sleep" && i.sleepEnd === null,
    );

  async function act(operation) {
    try {
      await operation();
    } catch (error) {
      $("checkin-status").textContent =
        error.message || "记录未能保存，请重试。";
      refresh();
    }
  }
  function edit(item, finish = false) {
    return openCareEditor(store, {
      day: date.value,
      item,
      finish,
      onSave(durable, day) {
        date.value = day;
        $("log-history").open = true;
        saved(durable, "已保存照护记录");
      },
    });
  }
  detail.onclick = () => act(() => edit());
  wake.onclick = () =>
    act(() => {
      store.read();
      const item = activeSleep();
      if (item) return edit(item, true);
      render();
    });
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
      box.onchange = () =>
        act(async () => {
          const completed = box.checked;
          let durable = true;
          if (store.nativeIds.has(item.id)) {
            await bridge().toggleTask({ id: item.id, completed });
            store.read();
          } else durable = store.toggle(item.id, completed);
          saved(durable, completed ? "已完成" : "已恢复为待办");
          $("checkin-tasks")
            .querySelector('[data-id="' + item.id + '"] input')
            ?.focus({ preventScroll: true });
        });
      label.append(box);
    }
    const caption = document.createElement("span");
    caption.textContent =
      item.kind === "task"
        ? item.title + (item.caregiver ? " · " + item.caregiver : "")
        : careDescription(item);
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
    if (item.kind !== "task") {
      const modify = button("编辑", "remove-checkin");
      modify.setAttribute("aria-label", "编辑" + item.title);
      modify.onclick = () => act(() => edit(item));
      li.append(modify);
    }
    if (!historical || item.kind !== "task") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-checkin";
      remove.textContent = "移除";
      remove.setAttribute("aria-label", "移除" + item.title);
      remove.onclick = () =>
        act(async () => {
          if (!window.confirm("移除「" + item.title + "」？")) return;
          if (store.nativeIds.has(item.id)) {
            const host = bridge();
            await (item.kind === "task"
              ? host.removeTask({ id: item.id })
              : host.removeCare({ id: item.id }));
            const durable = store.clearLocalCopy(item.id);
            store.read();
            saved(durable, "已移除");
          } else saved(store.write(item.id, null), "已移除");
        });
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
    detail.textContent = historical ? "补记这一天" : "详细记录 / 补记";
    const ongoing = activeSleep();
    wake.hidden = !ongoing;
    if (ongoing)
      wake.textContent = "结束睡眠 · " + careTime(ongoing.created) + " 入睡";
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
    act(async () => {
      let durable = true;
      if (bridge()?.addTask) {
        await bridge().addTask({
          title: title.value.trim(),
          ...store.signature(),
        });
        store.read();
      } else durable = store.add("task", title.value);
      title.value = "";
      date.value = localDay();
      saved(durable, "已添加待办");
    });
  };
  for (const btn of $("quick-checkins").querySelectorAll("button")) {
    btn.onclick = () =>
      act(async () => {
        const kind = btn.dataset.kind;
        store.read();
        const running = kind === "sleep" ? activeSleep() : undefined;
        if (running) {
          await edit(running, true);
          return;
        }
        if (bridge()?.openCare) {
          const profile = store.profile?.() ?? {};
          await bridge().openCare({
            kind,
            caregiver: profile.caregiver ?? "",
            feeding: profile.feeding ?? "",
            amount: profile.amount ?? "",
          });
          return;
        }
        const durable =
          kind === "sleep"
            ? store.saveCare(kind, new Date(), { sleepEnd: null })
            : store.add(kind, btn.dataset.title);
        date.value = localDay();
        $("log-history").open = true;
        saved(durable, "已记" + btn.dataset.title);
      });
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
    if (!e.key || e.key.startsWith(prefix)) {
      refresh();
      changed();
    }
  });
  window.addEventListener("xiaomai:care-change", () => {
    refresh();
    changed();
  });
  window.addEventListener("xiaomai-care-change", render);
  // Keep a page left open across local midnight on the correct day.
  setInterval(() => {
    if (localDay() !== today) {
      render();
      changed();
    }
  }, 30000);
  render();
  return refresh;
}
