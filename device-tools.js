import { parseNotebookBackup, mergeEntry } from "./notes.js";

const $ = (id) => document.getElementById(id);

export function setupDeviceTools(book, cards, onImport) {
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
    $("tools-dialog").showModal();
  };
  $("export").onclick = () => {
    const blob = new Blob([JSON.stringify(book.backup(), null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.download =
      "小麦成长经验-" + new Date().toISOString().slice(0, 10) + ".json";
    link.href = URL.createObjectURL(blob);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    $("backup-message").textContent = "已生成备份，请保存到手机文件。";
  };
  $("import").onclick = () => $("import-file").click();
  $("import-file").onchange = async () => {
    const input = $("import-file"),
      file = input.files[0];
    if (!file) return;
    try {
      const { entries, favorites } = parseNotebookBackup(
        await file.text(),
        new Set(cards.keys()),
      );
      book.read();
      let durable = true;
      for (const item of entries) {
        const merged = mergeEntry(book.entries.get(item.id), item);
        if (!book.set(item.id, merged.text, merged.updated)) durable = false;
      }
      for (const id of favorites)
        if (!book.setFavorite(id, true)) durable = false;
      onImport();
      $("backup-message").textContent = durable
        ? "已合并 " +
          entries.length +
          " 条经验、" +
          favorites.length +
          " 张收藏。"
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
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker
      .register("./sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        offlineReady = true;
        installInfo();
      })
      .catch(() => installInfo());
  }
}
