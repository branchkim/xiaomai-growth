import {
  legacyTasks,
  validateLegacyTasks,
  importLegacyTasks,
  renderLegacyTasks,
} from "./legacy-tasks.js";
import { parseNotebookBackup, mergeEntry } from "./notes.js";

import { saveFile, validateGrowthRecords } from "./growth-store.js";
import {
  clearDiary,
  exportDiary,
  importDiary,
  validateDiaryBackup,
} from "./diary.js";
const $ = (id) => document.getElementById(id);

export function setupDeviceTools(book, cards, checkins, growth, onImport) {
  renderLegacyTasks();
  let installPrompt;
  let offlineReady = false;
  function installInfo() {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigator.standalone;
    const ua = navigator.userAgent;
    const iphone =
      /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let message = iphone
      ? "在 Safari 点共享，选择「添加到主屏幕」，再点「添加」。"
      : /Android/i.test(ua)
        ? "在 Chrome 菜单选择「添加到主屏幕」或「安装应用」。"
        : "用手机打开此网址，在 Safari 的共享菜单或安卓 Chrome 菜单选择「添加到主屏幕」。";
    if (/MicroMessenger/i.test(ua))
      message =
        "先在微信右上角选择用系统浏览器打开，或复制网址到浏览器。" + message;
    if (window.xiaomaiNative) {
      $("install-guide").textContent = "正在使用小麦 iPhone App。";
      $("offline-status").textContent = "成长工具与卡片已随 App 离线安装。";
      $("install").hidden = true;
      return;
    }
    $("install-guide").textContent = standalone
      ? "你已经从主屏幕打开手账。"
      : message;
    $("install").hidden = standalone || !installPrompt;
    $("offline-status").textContent = offlineReady
      ? "已备好本机离线卡片。"
      : "首次联网打开后，支持的浏览器会缓存卡片。";
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installInfo();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installInfo();
  });
  $("install").onclick = async () => {
    const prompt = installPrompt;
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      installPrompt = null;
      installInfo();
    }
  };
  $("tools-button").onclick = () => {
    installInfo();
    $("backup-message").textContent = "";
    $("confirm-clear").checked = false;
    $("tools-dialog").showModal();
  };
  $("export").onclick = async () => {
    const button = $("export");
    button.disabled = true;
    try {
      const data = {
        ...book.backup(),
        checkins: checkins.backup(),
        growth: growth.store.snapshot(),
        nativeUndatedTasks: legacyTasks(),
        diary: await exportDiary(),
      };
      await saveFile(
        new Blob([JSON.stringify(data)], { type: "application/json" }),
        "小麦成长手账-" + new Date().toISOString().slice(0, 10) + ".json",
      );
      $("backup-message").textContent = "已生成备份，可保存到手机文件。";
    } catch (e) {
      $("backup-message").textContent = "备份未完成。" + e.message;
    } finally {
      button.disabled = false;
    }
  };
  $("clear-device").onclick = async () => {
    if (!$("confirm-clear").checked) {
      $("backup-message").textContent = "请先勾选清空确认。";
      return;
    }
    if (!window.confirm("永久删除这台设备的小麦记录和照片？")) return;
    try {
      if (window.xiaomaiNative) {
        if (!window.xiaomaiNative.clearCare)
          throw Error("请更新 App 后再清空全部记录。");
        await window.xiaomaiNative.clearCare();
      }
      await clearDiary();
      for (const key of Object.keys(localStorage))
        if (key.startsWith("xiaomai/")) localStorage.removeItem(key);
      if (window.xiaomaiNative?.setDefaults)
        await window.xiaomaiNative.setDefaults({
          caregiver: "",
          feeding: "",
          amount: "",
        });
      location.reload();
    } catch (e) {
      $("backup-message").textContent =
        "清理未完成，请检查后重试。" + e.message;
    }
  };
  $("import").onclick = () => $("import-file").click();
  $("import-file").onchange = async () => {
    const input = $("import-file"),
      file = input.files[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const extended = JSON.parse(raw);
      const {
        entries,
        favorites,
        checkins: importedCheckins,
      } = parseNotebookBackup(raw, new Set(cards.keys()));
      const records = validateGrowthRecords(extended.growth);
      const diary = validateDiaryBackup(extended.diary);
      const legacy = validateLegacyTasks(extended.nativeUndatedTasks);
      await importDiary(diary);
      await importLegacyTasks(legacy);
      growth.store.merge(records);
      book.read();
      let durable = true;
      for (const item of entries) {
        const merged = mergeEntry(book.entries.get(item.id), item);
        if (!book.set(item.id, merged.text, merged.updated)) durable = false;
      }
      for (const id of favorites)
        if (!book.setFavorite(id, true)) durable = false;
      if (!(await checkins.importBackup(importedCheckins))) durable = false;
      renderLegacyTasks();
      onImport();
      $("backup-message").textContent = durable
        ? "已合并 " +
          entries.length +
          " 条经验、" +
          favorites.length +
          " 张收藏、" +
          importedCheckins.length +
          " 条打卡、" +
          records.length +
          " 条成长资料、" +
          diary.length +
          " 篇日记。" +
          (legacy.length ? "旧版待办 " + legacy.length + " 条。" : "")
        : "已读入本页，设备保存失败，请导出备份。";
    } catch (error) {
      $("backup-message").textContent =
        error instanceof SyntaxError
          ? "文件不是有效的 JSON 备份。"
          : error.message;
    } finally {
      input.value = "";
    }
  };
  if (
    !window.xiaomaiNative &&
    "serviceWorker" in navigator &&
    window.isSecureContext
  ) {
    navigator.serviceWorker
      .register("./sw.js", { updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        offlineReady = true;
        installInfo();
      })
      .catch(() => installInfo());
  }
}
