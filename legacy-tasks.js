// Early iPhone builds saved task completion without a date. Keep those tasks undated.
const prefix = "xiaomai/legacy-tasks/v1/";
export function validateLegacyTasks(rows = []) {
  if (!Array.isArray(rows)) throw Error("旧版待办格式有误。");
  const seen = new Set();
  return rows.map((r) => {
    if (
      !r ||
      typeof r.id !== "string" ||
      !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
        r.id,
      ) ||
      seen.has(r.id.toLowerCase()) ||
      typeof r.title !== "string" ||
      !r.title.trim() ||
      Array.from(r.title).length > 100 ||
      typeof r.completed !== "boolean" ||
      (r.updated != null && !Number.isFinite(Date.parse(r.updated)))
    )
      throw Error("旧版待办格式有误。");
    const id = r.id.toLowerCase();
    seen.add(id);
    return {
      id,
      title: r.title,
      completed: r.completed,
      ...(r.updated ? { updated: r.updated } : {}),
    };
  });
}
export function legacyTasks() {
  if (window.xiaomaiNative?.legacyTasks)
    return validateLegacyTasks(window.xiaomaiNative.legacyTasks);
  return Object.keys(localStorage)
    .filter((k) => k.startsWith(prefix))
    .map((k) => JSON.parse(localStorage.getItem(k)));
}
export async function importLegacyTasks(rows) {
  if (!rows.length) return;
  if (window.xiaomaiNative?.mergeLegacyTasks) {
    if ((await window.xiaomaiNative.mergeLegacyTasks(rows)) === false)
      throw Error("旧版待办未能保存，请重新导入备份。");
    return;
  }
  for (const row of rows) {
    const key = prefix + row.id,
      existing = JSON.parse(localStorage.getItem(key));
    if (
      !existing ||
      (Date.parse(row.updated) || 0) > (Date.parse(existing.updated) || 0)
    )
      localStorage.setItem(key, JSON.stringify(row));
  }
  renderLegacyTasks();
}
export function renderLegacyTasks() {
  const container = document.getElementById("legacy-tasks");
  if (!container || window.xiaomaiNative) return;
  let rows;
  try {
    rows = legacyTasks();
  } catch {
    return;
  }
  container.hidden = !rows.length;
  container.replaceChildren();
  if (rows.length) {
    const headline = document.createElement("summary");
    headline.textContent = "无日期的旧版待办 · " + rows.length;
    container.append(headline);
  }
  for (const row of rows) {
    const label = document.createElement("label"),
      box = document.createElement("input");
    box.type = "checkbox";
    box.checked = row.completed;
    label.append(box, " " + row.title);
    container.append(label);
    box.onchange = async () => {
      try {
        await importLegacyTasks([
          { ...row, completed: box.checked, updated: new Date().toISOString() },
        ]);
      } catch {
        box.checked = row.completed;
      }
    };
  }
}
