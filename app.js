import {Notebook, parseBackup, mergeEntry} from "./notes.js";

const $ = id => document.getElementById(id);
const make = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
const drawings = {
  book:'<path d="M12 6c-3-2-6-2-9-1v13c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v13"/>',
  install:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  pencil:'<path d="m5 15 10-10 4 4L9 19l-5 1 1-5Zm8-8 4 4"/>',
  search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  sprout:'<path d="M12 21V11m0 4C6 16 3 12 3 7c5 0 9 2 9 8Zm0-4c0-6 4-9 9-9 0 6-3 10-9 9Z"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>'
};
function icon(name) {
  const holder = make("span");
  holder.setAttribute("aria-hidden","true");
  // Static icon paths only. User data is always rendered with textContent.
  holder.innerHTML = '<svg viewBox="0 0 24 24" focusable="false">'+drawings[name]+'</svg>';
  return holder;
}
document.querySelectorAll("[data-icon]").forEach(el=>el.append(icon(el.dataset.icon)));
let data, book, cards, stages, currentCard, stageId, installPrompt;
let offlineReady = false;
let storage;
try { storage = window.localStorage; } catch { storage = null; }

const formatDate = value => new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",year:"numeric"}).format(new Date(value));
const orderedNotes = () => [...book.entries].sort((a,b)=>Date.parse(b[1].updated)-Date.parse(a[1].updated));
let returnHash = "#home";
const openCard = (id) => {returnHash = location.hash === "#notes" ? "#notes" : "#home"; location.hash = "card/"+id;};
function listButton(card, subtitle) {
  const button = make("button",undefined,"card-row");
  const mini = make("span",undefined,"mini"); mini.append(icon(book.entries.has(card.id) ? "pencil" : "book"));
  const body = make("span",undefined,"row-content"); body.append(make("span",card.title));
  if (subtitle) body.append(make("small",subtitle));
  const end = make("span",undefined,"chevron"); end.append(icon("chevron"));
  button.append(mini,body,end);button.onclick=()=>openCard(card.id);
  return button;
}
function drawJournal() {
  const term = $("search").value.trim().toLowerCase();
  const rows = data.cards.filter(card=>term ? [card.title, card.reason, ...card.steps, stages.get(card.stage).label].join(" ").toLowerCase().includes(term) : card.stage === stageId);
  const stage = stages.get(stageId);
  $("chapter").textContent = term ? "搜索结果" : stage.name;
  $("chapter-description").textContent = (term ? "全部月龄" : stage.label)+" · "+rows.length+" 张卡片";
  $("stages").replaceChildren(...data.stages.map(item=>{
    const b=make("button",item.label.replace("第1个月（新生儿）","新生儿"));b.setAttribute("aria-pressed",String(!term && item.id===stageId));
    b.onclick=()=>{stageId=item.id;try{storage?.setItem("xiaomai/stage",item.id);}catch{} $("search").value=""; drawJournal();const selected=$("stages").querySelector('[aria-pressed=true]');selected?.focus({preventScroll:true});};
    return b;
  }));
  $("card-list").replaceChildren(...rows.map(card=>listButton(card,term ? stages.get(card.stage).label : "")));
  if (!rows.length) {
    const empty=make("div",undefined,"empty");empty.append(make("p","没有找到相关卡片，可以换个词，或返回当前月龄。"));
    const clear=make("button","清除搜索","outline");clear.onclick=()=>{$("search").value="";drawJournal();$("search").focus();};empty.append(clear);$("card-list").append(empty);
  }
  $("collection-count").textContent = data.stages.length+" 个月龄阶段 · "+data.cards.length+" 张育儿卡片";
}
function drawNotes() {
  const list = orderedNotes();
  $("memo-lead").textContent=list.length ? "这台设备上已记下 "+list.length+" 条经验。" : "从一张育儿卡片开始，记下小麦喜欢的安抚方式，或今天试过的小办法。";
  $("recent").replaceChildren(...list.slice(0,2).map(([id])=>{const a=make("a",cards.get(id).title,"recent-link");a.href="#card/"+id;return a;}));
  $("notes-list").replaceChildren();
  if (!list.length) {const empty=make("div",undefined,"empty"); empty.append(make("h3","还没有写下经验"),make("p","点开任意月龄卡片，在「我家的经验」里写第一条。")); const a=make("a","去选一张卡片","text-link");a.href="#home";empty.append(a);$("notes-list").append(empty);}
  for(const [id,item] of list) {
    const card=cards.get(id), article=make("article",undefined,"note-item");
    const a=make("a",card.title);a.href="#card/"+id;a.onclick=()=>{returnHash="#notes";};const h=make("h3");h.append(a);
    article.append(h,make("small",stages.get(card.stage).label+" · "+formatDate(item.updated),"muted"),make("p",item.text));
    $("notes-list").append(article);
  }
}
function route() {
  const hash=location.hash.slice(1);
  const card=hash.startsWith("card/") ? cards.get(hash.slice(5)) : undefined;
  const notesPage=hash==="notes" || (card && returnHash==="#notes");
  $("home").hidden=!!notesPage;$("notes").hidden=!notesPage;
  document.querySelectorAll("[data-route]").forEach(a=>{if(a.dataset.route===(notesPage?"notes":"home"))a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");});
  const dialog=$("card-dialog");
  if(card) {
    if(currentCard!==card.id || !dialog.open) {
      currentCard=card.id;
      $("detail-title").textContent=card.title;$("detail-stage").textContent=stages.get(card.stage).label;
      $("detail-reason").textContent=card.reason;$("detail-steps").replaceChildren(...card.steps.map(text=>make("p",text)));
      $("detail-ref").href=card.reference;$("experience").value=book.entries.get(card.id)?.text||"";
      $("save-state").textContent=book.pending.has(card.id) ? "尚未保存到设备，请从「安装与备份」导出。" : "只保存在这台设备，输入后自动保存。";
      if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
    }
  } else {currentCard=null;if(dialog.open)dialog.close();}
  if(!card){drawJournal();drawNotes();}
}
function closeCard() {
  if(!location.hash.startsWith("#card/"))return;
  if (enteredFromPage) history.back(); else location.replace(returnHash);
}
let enteredFromPage=false;
window.addEventListener("hashchange",event=>{
  const prev=new URL(event.oldURL).hash;
  if(location.hash.startsWith("#card/")){enteredFromPage=!prev.startsWith("#card/") && !!event.oldURL;returnHash=prev==="#notes"?"#notes":"#home";}
  if(cards)route();
});
$("card-dialog").addEventListener("cancel",event=>{event.preventDefault();closeCard();});
document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>btn.closest("dialog").id==="card-dialog"?closeCard():btn.closest("dialog").close());
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("click",event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom){if(dialog.id==="card-dialog")closeCard();else dialog.close();}}});
}
$("experience").addEventListener("input",()=>{
  if(!currentCard)return;
  const ok=book.set(currentCard,$("experience").value);
  $("save-state").textContent=ok ? "已保存到这台设备" : "浏览器未能保存。请保持页面打开，并从「安装与备份」导出。";
});
window.addEventListener("storage",()=>{if(!book)return;book.read();if(!currentCard){drawNotes();drawJournal();}else if(document.activeElement!==$("experience"))$("experience").value=book.entries.get(currentCard)?.text||"";});
$("start").onclick=()=>$("journal").scrollIntoView({block:"start"});
$("search").addEventListener("input",()=>{if(cards)drawJournal();});
function installInfo(){
  const standalone=window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const ua=navigator.userAgent;
  const iphone=/iPad|iPhone|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const wechat=/MicroMessenger/i.test(ua);
  let message=iphone ? "在 Safari 点共享，选择「添加到主屏幕」，如有「作为网页 App 打开」请开启，再点「添加」。" : /Android/i.test(ua) ? "在 Chrome 菜单选择「添加到主屏幕」或「安装应用」，然后确认。" : "在手机浏览器打开这个网址。iPhone 用 Safari 的共享菜单，安卓用 Chrome 菜单，选择「添加到主屏幕」。";
  if(wechat)message="先用微信右上角菜单在系统浏览器打开。如果没有这个选项，复制网址，粘贴到浏览器。"+message;
  $("install-guide").textContent=standalone ? "你已经从主屏幕打开手账。" : message;
  $("install").hidden=standalone || !installPrompt;
  $("offline-status").textContent=offlineReady ? "本设备已备好离线卡片。" : "第一次请联网打开，离线内容会在浏览器支持时自动保存。";
}
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;installInfo();});
window.addEventListener("appinstalled",()=>{installPrompt=null;installInfo();});
$("install").onclick=async()=>{const prompt=installPrompt;if(prompt){await prompt.prompt();await prompt.userChoice;installPrompt=null;installInfo();}};
$("tools-button").onclick=()=>{installInfo();$("backup-message").textContent="";$("tools-dialog").showModal();};
$("export").onclick=()=>{
  if(!book)return;
  const blob=new Blob([JSON.stringify(book.backup(),null,2)],{type:"application/json"});
  const link=make("a");link.download="小麦成长经验-"+new Date().toISOString().slice(0,10)+".json";link.href=URL.createObjectURL(blob);
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),60000);$("backup-message").textContent="已生成备份，请保存到手机文件。";
};
$("import").onclick=()=>$("import-file").click();
$("import-file").onchange=async()=>{
  const input=$("import-file"),file=input.files[0];if(!file||!book)return;
  try{
    const entries=parseBackup(await file.text(),new Set(cards.keys()));book.read();let durable=true;
    for(const item of entries){const value=mergeEntry(book.entries.get(item.id),item);if(!book.set(item.id,value.text,value.updated))durable=false;}
    drawJournal();drawNotes();$("backup-message").textContent=durable?"已合并 "+entries.length+" 条记录。":"已读入本次页面，设备没有保存成功，请重新导出备份。";
  }catch(err){$("backup-message").textContent=err instanceof SyntaxError?"文件不是有效的 JSON 备份。":err.message;}
  finally{input.value="";}
};
async function start(){
  try {
    const response=await fetch("./cards.json");if(!response.ok)throw new Error("cards");
    data=await response.json();cards=new Map(data.cards.map(c=>[c.id,c]));stages=new Map(data.stages.map(s=>[s.id,s]));
    stageId=data.stages[0].id;try{const saved=storage?.getItem("xiaomai/stage");if(stages.has(saved))stageId=saved;}catch{}
    book=new Notebook(storage,new Set(cards.keys()));drawJournal();drawNotes();route();
  }catch { $("chapter").textContent="手账暂时未能打开";$("chapter-description").textContent="请联网后刷新页面。";}
  if("serviceWorker" in navigator && window.isSecureContext){
    try {await navigator.serviceWorker.register("./sw.js");await navigator.serviceWorker.ready;offlineReady=true;installInfo();}catch{installInfo();}
  }
}
start();
