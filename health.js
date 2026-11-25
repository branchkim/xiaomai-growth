import { regular, checkups, optionalVaccines, observationGroups, sources, metrics } from "./health-data.js";
import { growth, percentiles } from "./health-growth.js";

const dayMs = 86400000;
const sections = { plan:"疫苗与儿保", measure:"生长曲线", observe:"发育观察" };
const kinds = { vaccine:"免疫规划", checkup:"儿保", optional:"自选疫苗", custom:"自定义" };
const stageTitle = month => month === 0 ? "出生月" : String(month) + " 月龄";
const states = new WeakMap();

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key,value] of Object.entries(attrs)) {
    if (key.startsWith("on")) node.addEventListener(key.slice(2),value);
    else if (value !== undefined && value !== false) node.setAttribute(key,value === true ? "" : String(value));
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) node.append(child);
  return node;
}
const block = (...children) => el("div",{class:"health-block"},...children);
const hint = text => el("p",{class:"health-hint"},text);
const row = (...children) => el("div",{class:"health-row"},...children);
const field = (label,input) => el("label",{class:"health-field"},el("span",{},label),input);
const btn = (text,action,more = {}) => el("button",{type:"button",onclick:action,...more},text);
function select(label, choices, current, change, attrs = {}) {
  const node = el("select", {"aria-label":label,...attrs});
  for (const [value,text] of choices) node.append(el("option",{value,selected:String(current) === String(value)},text));
  if (change) node.addEventListener("change",()=>change(node.value));
  return node;
}
function sourceList(...keys) {
  return el("details",{class:"health-sources"},el("summary",{},"查看依据"),...keys.map(key => {
    const [label,url] = sources[key];
    return el("a",{href:url,target:"_blank",rel:"noopener noreferrer"},label + " ↗");
  }));
}
function isoDay(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) return null;
  const date = new Date(value+"T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === value ? date : null;
}
function today() {
  const now = new Date();
  return [now.getFullYear(),now.getMonth()+1,now.getDate()].map((n,i)=>i ? String(n).padStart(2,"0") : n).join("-");
}
const iso = date => date.toISOString().slice(0,10);
function addDays(day, offset) {
  const date = isoDay(day);
  return date ? iso(new Date(+date + offset * dayMs)) : "";
}
export function monthlyDate(birth, months) {
  const date = isoDay(birth);
  if (!date || !Number.isInteger(months)) return "";
  const month = date.getUTCMonth() + months;
  const year = date.getUTCFullYear();
  const last = new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return iso(new Date(Date.UTC(year,month,Math.min(last,date.getUTCDate()))));
}
export function ageAt(birth, day) {
  const start = isoDay(birth), end = isoDay(day);
  if (!start || !end || day < birth) return null;
  let m = (end.getUTCFullYear()-start.getUTCFullYear())*12 + end.getUTCMonth()-start.getUTCMonth();
  if (monthlyDate(birth,m) > day) m--;
  const from = +isoDay(monthlyDate(birth,m)), until = +isoDay(monthlyDate(birth,m+1));
  return m + (+end-from)/(until-from);
}
function leads(ctx) {
  const raw = ctx.profile().leadDays;
  return raw != null && Number.isInteger(Number(raw)) ? Math.min(30,Math.max(0,Number(raw))) : 1;
}
export function plans(ctx) {
  const birth = ctx.profile().birthday;
  const records = ctx.store.list("visit");
  const saved = new Map(records.map(x=>[x.id,x]));
  const catalog = [...regular,...checkups];
  const first = saved.get("je-1");
  if (first?.course === "inactive" || saved.get("je-2")?.actual || saved.get("je-2")?.appointment) {
    catalog.push({id:"je-2",kind:"vaccine",month:8,title:"乙脑灭活疫苗 · 第 2 剂",detail:"常规与灭活第 1 剂间隔 7–10 天。请用实际首剂日期和门诊给出的预约日期核对。"});
  }
  for (const r of records) {
    if (r.custom === true && ["custom","optional"].includes(r.kind) && r.title && Number.isInteger(Number(r.month)) && +r.month >= 0 && +r.month <= 12) {
      catalog.push({id:r.id,kind:r.kind,month:Number(r.month),title:String(r.title),detail:r.kind==="optional" ? "自愿选择；接种年龄、剂次及间隔按当地门诊及所用产品说明书。":"按家庭或门诊安排。",custom:true});
    }
  }
  return catalog.map(p=>{
    const record = saved.get(p.id) || {};
    let target = monthlyDate(birth,p.month);
    if (p.id==="home-visit" || p.custom) target = "";
    if (p.id==="je-2") target = addDays(first?.actual,7);
    const windowEnd = p.id==="je-2" ? addDays(first?.actual,10) : "";
    const appointment = isoDay(record.appointment) ? record.appointment : "";
    const actual = isoDay(record.actual) ? record.actual : "";
    return {...p, target, windowEnd, appointment, actual, record};
  }).sort((a,b)=>a.month-b.month);
}
function targetText(p) {
  if (p.id==="home-visit") return "出院后一周内";
  if (p.windowEnd) return "参考窗口 " + p.target + " 至 " + p.windowEnd;
  if (p.id==="je-2") return "待核对首剂实种日期";
  if (p.custom) return "按门诊或家庭安排";
  return p.target ? "参考月龄日 " + p.target : stageTitle(p.month);
}
export function visitStatus(p) {
  if (p.actual) return "已记录 · " + p.actual;
  if (p.appointment) return "已约 · " + p.appointment;
  return targetText(p);
}
const groupFor = age => observationGroups.find(g=>age<=g.month)?.month || 12;
function nextPlan(ctx, all, age) {
  const day = today(), until = addDays(day, leads(ctx));
  const pending = all.filter(p=>!p.actual);
  const appointments = pending.filter(p=>p.appointment && p.appointment>=day);
  appointments.sort((a,b)=>a.appointment.localeCompare(b.appointment));
  const booked = appointments[0];
  if (booked && booked.appointment <= until) return booked;
  if (age === null || age > 12) return booked;
  const referenced = pending.filter(p => !p.appointment && p.month >= age && (p.target || p.id==="home-visit" || p.custom));
  referenced.sort((a,b)=>a.month-b.month || (a.target || "9999").localeCompare(b.target || "9999"));
  const pick = referenced[0];
  return !pick || (booked && booked.appointment <= (pick.target || "9999")) ? booked : pick;
}
function gameFor(ctx,age) {
  if (!Number.isInteger(age)) return null;
  const cards=(ctx.cards || []).filter(c=>Array.isArray(c.activity?.window) && age>=c.activity.window[0] && age<c.activity.window[1]);
  if (!cards.length) return null;
  const selected=cards[Math.floor(+isoDay(today())/dayMs)%cards.length];
  return {title:selected.activity.title || selected.title,cardId:selected.id};
}
const simpleMark = (month,id) => "mark-"+month+"-"+id;
export function healthToday(ctx) {
  const age = ctx.ageMonths();
  const result = {};
  const prefs = ctx.profile().reminders || {};
  const found = nextPlan(ctx,plans(ctx),age);
  if (prefs.plan !== false && found) result.plan = {title:found.title,visitId:found.id,detail:found.appointment ? "已预约 " + found.appointment : stageTitle(found.month) + " · " + targetText(found) + "，可对照手册补记。"};
  if (!Number.isInteger(age) || age<0 || age>12) return result;
  if (prefs.observation !== false && age===0) {
    result.observation = {title:"吃奶、换尿布时，留意宝宝怎样回应你",detail:"在他清醒时轻声说话，看看眼神或动作有什么变化。"};
  } else if (prefs.observation !== false) {
    const group = observationGroups.find(g=>g.month===groupFor(age));
    const done = new Set(ctx.store.list("milestone").filter(x=>isoDay(x.date)).map(x=>x.id));
    const item = group.marks.find(([id])=>!done.has(simpleMark(group.month,id)));
    if (item) result.observation = {title:item[1],milestoneId:simpleMark(group.month,item[0]),detail:"满 "+group.month+" 月龄观察项。日常碰巧见到时记下，不必专门测试。"};
  }
  if (prefs.activity !== false) {
    const activity=gameFor(ctx,age);
    if (activity) result.activity=activity;
  }
  return result;
}
function metricText(rec) {
  return Object.entries(metrics).filter(([k])=>Number(rec[k])>0).map(([k,m])=>m.title+" "+rec[k]+" "+m.unit).join("，");
}
export function healthReport(ctx) {
  const lines = ["【生长测量】"];
  const measures = ctx.store.list("measurement").filter(r=>isoDay(r.date)).sort((a,b)=>a.date.localeCompare(b.date));
  lines.push(...(measures.length ? measures.map(r=>r.date+"　"+metricText(r)) : ["未记录"]));
  lines.push("", "【接种与儿保记录】");
  const recorded = plans(ctx).filter(p=>p.actual || p.appointment || p.record.note || p.custom);
  lines.push(...(recorded.length ? recorded.map(p=>[p.title,p.record.course==="inactive" ? "灭活制剂" : p.record.course==="live" ? "减毒活制剂" : "",p.appointment && "预约 "+p.appointment,p.actual && "实际 "+p.actual,p.record.note].filter(Boolean).join(" · ")) : ["未记录"]));
  lines.push("","【发育观察】");
  const marks = new Map(ctx.store.list("milestone").map(r=>[r.id,r]));
  const obs = [];
  for (const g of observationGroups) for (const [id,title] of g.marks) {
    const r = marks.get(simpleMark(g.month,id));
    if (r?.date || r?.note) obs.push([title,r.date && "首次 "+r.date,r.note].filter(Boolean).join(" · "));
  }
  lines.push(...(obs.length ? obs : ["未记录"]));
  return lines.join("\n");
}
function safeIcs(s) {
  return String(s).replace(/\\/g,"\\\\").replace(/\r\n|[\r\n]/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
}
function foldLine(line) {
  const enc = new TextEncoder();
  let bytes = 0, out = "";
  for (const c of line) {
    const n = enc.encode(c).length;
    if (bytes+n > 75) { out+="\r\n "; bytes=1; }
    out+=c; bytes+=n;
  }
  return out;
}
export function makeCalendar(id,title,date,leadDays=1) {
  if (!isoDay(date)) throw new Error("请先填写门诊确认的预约日期。");
  const lead = Number.isInteger(leadDays) ? Math.max(0,Math.min(30,leadDays)) : 1;
  const compact = s=>s.replace(/-/g,"");
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Xiaomai//Family Journal//ZH","CALSCALE:GREGORIAN","BEGIN:VEVENT",
    "UID:"+String(id).replace(/[^A-Za-z0-9-]/g,"")+"@xiaomai.local","DTSTAMP:"+new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,""),
    "DTSTART;VALUE=DATE:"+compact(date),"DTEND;VALUE=DATE:"+compact(addDays(date,1)),"SUMMARY:"+safeIcs(title),"DESCRIPTION:"+safeIcs("预约日期请以门诊确认为准。"),
    "BEGIN:VALARM","TRIGGER:"+(lead===0 ? "PT0S" : "-P"+lead+"D"),"ACTION:DISPLAY","DESCRIPTION:"+safeIcs(title),"END:VALARM","END:VEVENT","END:VCALENDAR",""].map(foldLine).join("\r\n");
}
async function calendar(ctx,p) {
  const lead = leads(ctx);
  try {
    const bytes = makeCalendar(p.id,p.title,p.appointment,lead);
    const blob = new Blob([bytes],{type:"text/calendar;charset=utf-8"});
    await ctx.saveFile(blob,"预约-"+p.appointment+".ics");
    ctx.notify("请在系统日历中打开并保存，提醒时间可在日历中调整。");
  } catch(e) { ctx.notify(e.message || "日历文件未导出。"); }
}
const newId = prefix => prefix+"-"+(globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
function update(ctx,ui,work,message) {
  try { work(); } catch(e) { ctx.notify(e.message || "本机保存失败，请重试。"); return false; }
  ui.draw();
  ctx.refresh();
  ctx.notify(message);
  return true;
}
function dateField(value,attrs={}) { return el("input",{type:"date",value:value || "",...attrs}); }
function details(title,...children) {return el("details",{class:"health-details"},el("summary",{},title),...children);}
function visitEditor(ctx,ui,p) {
  const birth = ctx.profile().birthday;
  const panel = el("details",{class:"health-item"});
  if (ui.openVisit===p.id) {
    ui.openVisit = "";
    panel.open = true;
    globalThis.requestAnimationFrame?.(()=>{
      if (panel.isConnected && panel.open) panel.scrollIntoView({block:"nearest"});
    });
  }
  const badges = el("span",{class:"health-kind"},kinds[p.kind]);
  panel.append(el("summary",{},el("span",{},badges,el("strong",{},p.title)),el("small",{},visitStatus(p))));
  const form = el("form",{class:"health-form"});
  const appt = dateField(p.appointment,{min:isoDay(birth) ? birth : undefined});
  const actual = dateField(p.actual,{min:isoDay(birth) ? birth : undefined,max:today()});
  const note = el("textarea",{rows:2,maxlength:500,placeholder:"例如门诊地点、接种证上的制剂名称"},p.record.note || "");
  const course = p.id==="je-1" ? select("乙脑疫苗制剂",[["","待门诊确认"],["live","减毒活制剂"],["inactive","灭活制剂"]],p.record.course || "") : null;
  const actualLabel = ["vaccine","optional"].includes(p.kind) ? "实种日期" : "实际完成日期";
  form.append(hint(p.detail));
  if (p.custom) form.append(hint("计划月龄："+p.month+" 月龄"));
  if (p.record.product) {
    const product=optionalVaccines.find(v=>v.id===p.record.product);
    if (product) form.append(productInfo(product));
  }
  if (course) form.append(field("乙脑疫苗制剂",course));
  form.append(el("div",{class:"health-grid"},field("预约日期",appt),field(actualLabel,actual)),field("备注（选填）",note));
  function save(appointment,actualDate,newCourse) {
    if (p.id==="je-1" && newCourse!=="inactive" && plans(ctx).some(x=>x.id==="je-2" && (x.actual || x.appointment || x.record.note))) {
      ctx.notify("第 2 剂已有记录，请先核对并清空第 2 剂记录，再更改制剂。"); return;
    }
    const values = {appointment,actual:actualDate,note:note.value.trim()};
    if (p.custom) Object.assign(values,{custom:true,title:p.title,kind:p.kind,month:p.month,product:p.record.product || ""});
    if (course) values.course = newCourse;
    const ok = update(ctx,ui,()=>ctx.store.put("visit",p.id,values),"已保存计划记录。");
    if (ok && ctx.cancelReminder && (p.appointment!==appointment || actualDate)) {
      Promise.resolve().then(()=>ctx.cancelReminder(p.id)).catch(()=>ctx.notify("记录已保存。请到系统中核对旧提醒。"));
    }
  }
  form.addEventListener("submit",e=>{e.preventDefault();save(appt.value,actual.value,course?.value);});
  const actions = row(el("button",{type:"submit",class:"health-primary"},"保存日期与备注"));
  if (p.appointment) actions.append(btn("撤销预约",()=>save("",p.actual,course?.value)));
  if (p.actual) actions.append(btn("撤销完成记录",()=>save(p.appointment,"",course?.value)));
  if (p.custom) actions.append(btn("删除这项计划",()=>{
    if (!globalThis.confirm("删除这项自定义计划及其日期记录？")) return;
    const ok = update(ctx,ui,()=>ctx.store.remove("visit",p.id),"计划已删除。");
    if (ok && ctx.cancelReminder) Promise.resolve().then(()=>ctx.cancelReminder(p.id)).catch(()=>ctx.notify("计划已删除。请到系统中核对旧提醒。"));
  }));
  form.append(actions);
  if (p.appointment && !p.actual) {
    const reminderButtons = row(btn("导出日历提醒",()=>calendar(ctx,p)));
    if (ctx.remind && p.appointment >= today() && ctx.profile().reminders?.plan !== false) reminderButtons.append(btn("设置手机提醒",async()=>{
      try {
        await ctx.remind({id:p.id,title:p.title,date:p.appointment,leadDays:leads(ctx)});
        ctx.notify("已提交手机提醒。");
      } catch(e) { ctx.notify(e.message || "请检查系统的通知权限。"); }
    }));
    form.append(reminderButtons,hint("导入日历后若改期或取消，请在系统日历中同步修改。"));
  }
  panel.append(form);
  return panel;
}
function productInfo(product) {
  return el("div",{class:"health-product"},el("strong",{},product.title),el("p",{},product.prevents),el("p",{},product.timing),sourceList(product.source));
}
function customPlan(ctx,ui) {
  const form = el("form",{class:"health-form"});
  const description=el("div",{"aria-live":"polite"});
  const choices = [["custom","自定义计划"],...optionalVaccines.map((product,i)=>["vac-"+i,product.title])];
  const which = select("选择项目",choices,"custom",value=>{
    const product=optionalVaccines[Number(value.slice(4))];
    description.replaceChildren();
    if (product) description.append(productInfo(product));
    title.value = product ? product.title+" · " : "";
  });
  const title = el("input",{type:"text",maxlength:70,required:true,placeholder:"项目名称，可写明第几剂"});
  const age = ctx.ageMonths();
  const month = select("计划月龄",Array.from({length:13},(_,i)=>[i,stageTitle(i)]),ui.openCustom && /^\d+$/.test(ui.filter) ? +ui.filter : Number.isInteger(age) ? Math.min(12,Math.max(0,age)) : 0);
  const appt = dateField("",{min:ctx.profile().birthday || undefined});
  form.append(hint("自费疫苗可按接种门诊确认的产品、剂次与时间逐条添加。具体费用与本地免费政策请向门诊确认。"),
    field("选择项目",which),description,field("项目或疫苗名称",title),el("div",{class:"health-grid"},field("计划月龄",month),field("预约日期（选填）",appt)),
    el("button",{type:"submit",class:"health-primary"},"添加计划"));
  form.addEventListener("submit",e=>{
    e.preventDefault();
    if (!title.value.trim()) {ctx.notify("请填写项目名称。");return;}
    const item = {custom:true,kind:which.value==="custom" ? "custom" : "optional",month:Number(month.value),title:title.value.trim(),appointment:appt.value,actual:"",note:""};
    if (item.kind==="optional") item.product=optionalVaccines[Number(which.value.slice(4))].id;
    const oldFilter = ui.filter;
    ui.filter = month.value;
    const ok = update(ctx,ui,()=>ctx.store.put("visit",newId("custom"),item),"新计划已保存。");
    if (!ok) ui.filter = oldFilter;
  });
  const panel=details("＋ 添加自费疫苗或自定义计划",form);
  if (ui.openCustom) {
    panel.open=true; ui.openCustom=false;
    globalThis.requestAnimationFrame?.(()=>{if(panel.isConnected && panel.open) panel.scrollIntoView({block:"nearest"});});
  }
  return panel;
}
function planScreen(ctx,ui) {
  const all = plans(ctx), age = ctx.ageMonths();
  const suggested = nextPlan(ctx,all,age);
  const currentMonth = suggested?.month ?? (Number.isInteger(age) && age>=0 && age<=12 ? age : 0);
  const filter = select("按月龄筛选计划",[["near","近期 · "+stageTitle(currentMonth)],["all","全部月龄"],...Array.from({length:13},(_,i)=>[String(i),stageTitle(i)])],ui.filter,value=>{ui.filter=value;ui.draw();});
  const body = block(row(el("h3",{},"疫苗与儿保"),field("按月龄看",filter)),hint("按中国 2026 年常规免疫程序列出至周岁的项目。月龄日供核对，具体时间、补种、联合疫苗替代和特殊情况请听接种门诊安排。"));
  if (!isoDay(ctx.profile().birthday)) body.append(hint("在宝宝档案填入出生日期，即可显示对应的日历日期。"));
  body.append(customPlan(ctx,ui));
  const shown = all.filter(p=>ui.filter==="all" || p.month===(ui.filter==="near" ? currentMonth : Number(ui.filter)));
  if (!shown.length) body.append(hint("这个月龄暂无内置项目。有门诊安排时可自行添加。"));
  for (const month of [...new Set(shown.map(p=>p.month))]) {
    body.append(el("h4",{class:"health-month"},stageTitle(month)));
    for (const p of shown.filter(p=>p.month===month)) body.append(visitEditor(ctx,ui,p));
  }
  body.append(sourceList("vaccines","visits","optional"));
  return body;
}

function svgNode(name,attrs,content) {
  const e = document.createElementNS("http://www.w3.org/2000/svg",name);
  for (const [k,v] of Object.entries(attrs)) e.setAttribute(k,String(v));
  if (content!==undefined) e.textContent = content;
  return e;
}
export function plot(ctx, metric, sex, records, allLines, compact = false) {
  const m = metrics[metric], refs = growth[sex]?.[metric], birth = ctx.profile().birthday;
  if (!refs) return hint("请在档案填写性别，或在这里选择男童或女童参考表。");
  const points = records.map(r=>({age:ageAt(birth,r.date),v:Number(r[metric]),date:r.date})).filter(p=>p.v>0 && Number.isFinite(p.v) && p.age!==null && p.age>=0 && p.age<=12).sort((a,b)=>a.age-b.age);
  const floor = Math.floor(Math.min(...refs.map(r=>r[0]),...points.map(p=>p.v)));
  const ceiling = Math.ceil(Math.max(...refs.map(r=>r[6]),...points.map(p=>p.v)));
  const step = Math.max(1,Math.ceil((ceiling-floor)/5));
  const min = Math.floor(floor/step)*step, max = Math.ceil(ceiling/step)*step;
  const baseline = compact ? 82 : 178;
  const x = age=>34 + age/12*314, y = v=>baseline - (v-min)/(max-min)*(baseline-23);
  const svg = svgNode("svg",{viewBox:"0 0 385 "+(baseline+27),role:"img","aria-label":(sex==="male" ? "男童" : "女童")+m.title+"参考曲线，叠加 "+points.length+" 次个人测量"});
  for (let v=min;v<=max;v+=step) {
    svg.append(svgNode("line",{x1:34,x2:350,y1:y(v),y2:y(v),class:"h-grid"}),svgNode("text",{x:28,y:y(v)+3,"text-anchor":"end"},v));
  }
  for (let a=0;a<=12;a+=2) svg.append(svgNode("text",{x:x(a),y:baseline+18,"text-anchor":"middle"},a));
  svg.append(svgNode("text",{x:4,y:13},m.unit),svgNode("text",{x:compact ? 358 : 353,y:baseline+18},"月龄"));
  const line = (coords,cls)=>svgNode("polyline",{points:coords.join(" "),fill:"none",class:cls});
  const indices = allLines ? [0,1,2,3,4,5,6] : [0,3,6];
  if (compact) {
    const band = refs.map((r,a)=>x(a)+","+y(r[0])).concat(refs.map((r,a)=>x(a)+","+y(r[6])).reverse());
    svg.append(svgNode("polygon",{points:band.join(" "),class:"dash-chart-band"}));
  }
  for (const idx of indices) {
    svg.append(line(refs.map((r,a)=>x(a)+","+y(r[idx])),idx===3 ? "h-median" : [0,6].includes(idx) ? "h-edge" : "h-inner"));
    if ([0,3,6].includes(idx)) svg.append(svgNode("text",{x:352,y:y(refs[12][idx])+3},"P"+percentiles[idx]));
  }
  if (points.length) {
    svg.append(line(points.map(p=>x(p.age)+","+y(p.v)),"h-person"));
    for (const p of points) {
      const dot = svgNode("circle",{cx:x(p.age),cy:y(p.v),r:3.7,class:"h-dot"});
      dot.append(svgNode("title",{},p.date+" · "+p.v+" "+m.unit));
      svg.append(dot);
    }
  }
  const card = el("figure",{class:"health-chart"},svg,el("figcaption",{},el("span",{class:"health-line-key"},"参考百分位"),el("span",{class:"health-dot-key"},"个人测量 · "+points.length+" 次")));
  return card;
}
export function percentileBand(rows,age,value) {
  if (!rows || !Number.isFinite(age) || age<0 || age>12 || !Number.isFinite(value) || value<=0) return "";
  const lo=Math.floor(age), hi=Math.ceil(age);
  const limits=rows[lo].map((v,i)=>v+(rows[hi][i]-v)*(age-lo));
  for (let i=0;i<limits.length;i++) {
    if (Math.abs(value-limits[i])<1e-8) return "约 P"+percentiles[i];
    if (value<limits[i]) return i===0 ? "低于 P3" : "约 P"+percentiles[i-1]+"–P"+percentiles[i];
  }
  return "高于 P97";
}
function recentMeasure(ctx,sex,metric,records) {
  const r=records.find(record=>Number(record[metric])>0);
  if (!r) return hint("还没有"+metrics[metric].title+"测量。");
  const m=metrics[metric];
  const age=ageAt(ctx.profile().birthday,r.date);
  const band=percentileBand(growth[sex]?.[metric],age,Number(r[metric]));
  const detail=band ? "与所选参考人群对照："+band : age===null ? "填入正确出生日期后可估读百分位。" : age>12 ? "此测量日期超出 0–12 月龄参考范围。" : "选择参考人群后可估读百分位。";
  return el("div",{class:"health-latest"},el("small",{},"最近一次 · "+r.date),el("strong",{},m.title+" "+r[metric]+" "+m.unit),el("span",{},detail));
}
function referenceTable(sex,metric) {
  const refs = growth[sex]?.[metric];
  if (!refs) return null;
  const table = el("table",{},el("caption",{},(sex==="male" ? "男童" : "女童")+metrics[metric].title+"（"+metrics[metric].unit+"）"));
  table.append(el("thead",{},el("tr",{},...["月龄",...percentiles.map(p=>"P"+p)].map(t=>el("th",{scope:"col"},t)))));
  table.append(el("tbody",{},...refs.map((r,i)=>el("tr",{},el("th",{scope:"row"},String(i)),...r.map(n=>el("td",{},n.toFixed(1)))))));
  return details("查看各整月龄的参考数值",el("div",{class:"health-table",tabindex:"0"},table));
}
function measurementForm(ctx,ui,record) {
  const r=record || {}, form=el("form",{class:"health-form"});
  const date = dateField(r.date || today(),{min:ctx.profile().birthday || undefined,max:today(),required:true});
  const fields = {};
  const grid = el("div",{class:"health-grid"});
  for (const [key,m] of Object.entries(metrics)) {
    const input = el("input",{type:"number",inputmode:"decimal",step:m.step,min:m.step,max:key==="weight" ? 100 : 200,value:r[key] ?? "",placeholder:"选填"});
    fields[key]=input;
    grid.append(field(m.title+"（"+m.unit+"）",input));
  }
  form.append(field("测量日期",date),grid,hint("填写至少一项。身长用平躺测量值，体重请换算成千克。"),row(el("button",{type:"submit",class:"health-primary"},"保存测量"),btn("取消",()=>{ui.editMeasure=null;ui.draw();})));
  form.addEventListener("submit",e=>{
    e.preventDefault();
    const data={date:date.value};
    for (const [k,input] of Object.entries(fields)) data[k] = input.value ? Number(input.value) : null;
    if (!Object.keys(metrics).some(k=>data[k]>0)) {ctx.notify("请填写体重、身长或头围中的至少一项。");return;}
    const old = ui.editMeasure;
    ui.editMeasure=null;
    if (!update(ctx,ui,()=>ctx.store.put("measurement",r.id || newId("measure"),data),"测量已保存。")) ui.editMeasure=old;
  });
  return form;
}
function measureScreen(ctx,ui) {
  const records = ctx.store.list("measurement").filter(r=>isoDay(r.date)).sort((a,b)=>b.date.localeCompare(a.date));
  const sex=ui.sex || ctx.profile().sex || "", metric=ui.metric;
  const add=btn("＋ 记一次测量",()=>{ui.editMeasure="new";ui.draw();},{class:"health-primary"});
  const body=block(row(el("h3",{},"生长曲线"),add));
  if (ui.editMeasure==="new") body.append(measurementForm(ctx,ui));
  body.append(row(select("查看指标",Object.entries(metrics).map(([k,m])=>[k,m.title]),metric,v=>{ui.metric=v;ui.draw();}),
    select("参考人群",[["","选择参考人群"],["male","男童参考"],["female","女童参考"]],sex,v=>{ui.sex=v;ui.draw();}),
    select("参考线",[[0,"3 条参考线"],[1,"7 条参考线"]],ui.allLines ? 1 : 0,v=>{ui.allLines=v==="1";ui.draw();})),
    recentMeasure(ctx,sex,metric,records),plot(ctx,metric,sex,records,ui.allLines),
    hint("P50 表示同月龄、同性别参考人群的中位数。非整月龄按相邻整月参考线估读百分位区间。观察个人变化趋势，交由儿保医生结合胎龄、健康状况和测量方法解读。"));
  if (!isoDay(ctx.profile().birthday)) body.append(hint("填入出生日期后，可按实际测量日把个人数据叠加到图上。"));
  body.append(hint("图表范围从出生到满周岁当天，范围外的测量保留在下方记录中。"));
  const table = referenceTable(sex,metric);
  if (table) body.append(table);
  body.append(el("h4",{},"测量记录"));
  if (!records.length) body.append(hint("还没有测量。可以从出生时的数据记起。"));
  for (const r of records) {
    body.append(row(el("span",{},el("strong",{},r.date),el("small",{class:"health-record-values"},metricText(r))),
      btn("修改",()=>{ui.editMeasure=r.id;ui.draw();},{"aria-label":"修改 "+r.date+" 的测量"})));
    if (ui.editMeasure===r.id) body.append(measurementForm(ctx,ui,r),btn("删除这次测量",()=>{
      if (!globalThis.confirm("删除 "+r.date+" 的这次测量？")) return;
      update(ctx,ui,()=>ctx.store.remove("measurement",r.id),"已删除测量。");
    }));
  }
  body.append(sourceList("growth"));
  return body;
}
function milestoneEditor(ctx,ui,g,id,title,record) {
  const key=simpleMark(g.month,id), r=record || {};
  const date=dateField(r.date,{min:ctx.profile().birthday || undefined,max:today()});
  const note=el("textarea",{rows:2,maxlength:500,placeholder:"例如谁在场、当时在做什么"},r.note || "");
  const form=el("form",{class:"health-form"});
  const actions=row(el("button",{type:"submit",class:"health-primary"},"保存观察"));
  if (record) actions.append(btn("清除这条观察",()=>{
    if (!globalThis.confirm("清除这项的首次日期和观察文字？")) return;
    update(ctx,ui,()=>ctx.store.remove("milestone",key),"这条观察已清除。");
  }));
  form.append(field("首次做到日期（选填）",date),field("观察记录（选填）",note),actions);
  form.addEventListener("submit",e=>{
    e.preventDefault();
    if (!date.value && !note.value.trim()) {ctx.notify("请填入首次日期或一句观察。");return;}
    update(ctx,ui,()=>ctx.store.put("milestone",key,{date:date.value,note:note.value.trim()}),"观察已保存。");
  });
  const panel = el("details",{class:"health-item"},el("summary",{},el("strong",{},title),el("small",{},r.date ? "首次 "+r.date : r.note ? "已有观察" : "记一笔")),form);
  if (ui.openMark===key) {
    ui.openMark=""; panel.open=true;
    globalThis.requestAnimationFrame?.(()=>{ if (panel.isConnected && panel.open) panel.scrollIntoView({block:"nearest"}); });
  }
  return panel;
}
export function urgentSigns(month) {
  const content=[el("strong",{},"马上就医或呼叫当地急救"),el("p",{},"任何月龄：明显呼吸费力、口唇发青、抽搐或叫不醒，都要立即寻求急救。")];
  if (month<=6) content.push(el("p",{},"未满 3 月龄测得 38°C 或以上，或 3 至未满 6 月龄测得 39°C 或以上，应立即联系儿科就医评估。"));
  return el("aside",{class:"health-urgent"},...content);
}
function observeScreen(ctx,ui) {
  const month=ui.obsMonth, group=observationGroups.find(g=>g.month===month);
  const choose=select("观察月龄",[[0,"新生儿期"],...observationGroups.map(g=>[g.month,"满 "+g.month+" 月龄"])],month,v=>{ui.obsMonth=Number(v);ui.draw();});
  const body=block(row(el("h3",{},"发育观察"),field("查看阶段",choose)));
  const game=gameFor(ctx,month===0 ? 0 : month-1);
  if (game) body.append(el("a",{class:"health-game",href:"#card/"+encodeURIComponent(game.cardId)},"一起玩 · "+game.title+" →"));
  if (!group) {
    body.append(hint("每天吃奶、换尿布时，看宝宝清醒时的活动、吃奶和对声音的反应。日常观察到变化，可提前写进下一阶段的记录。"),
      el("div",{class:"health-alert"},el("h4",{},"新生儿出现这些情况要尽快就医"),el("p",{},"吃奶明显变差、比平常更难唤醒、呼吸费力、发热或身体异常发冷，都需要及时就医。抽搐、呼吸困难或叫不醒时，立即寻求急救。")),
      urgentSigns(0),btn("记下生活中的第一次",()=>{ui.obsMonth=3;ui.draw();}),sourceList("newborn","marks","urgent"));
    return body;
  }
  const records=new Map(ctx.store.list("milestone").map(r=>[r.id,r]));
  body.append(hint("把满 "+month+" 月龄附近自然发生的第一次留下来。没记过的项目保持空白，有想问医生的事也可以只写观察。"));
  body.append(el("div",{class:"health-alert"},el("h4",{},"满 "+month+" 月龄时值得问医生的信号"),
    el("ul",{},...group.flags.map(f=>el("li",{},f))),el("p",{},"在相应月龄观察到任一情况，或原本会的语言、交流能力逐渐消失，请尽早联系儿保或儿科评估。")));
  for (const [id,title] of group.marks) body.append(milestoneEditor(ctx,ui,group,id,title,records.get(simpleMark(month,id))));
  body.append(urgentSigns(month),sourceList("marks","flags","urgent"));
  return body;
}
export function mountHealth(container,ctx) {
  if (!container) return;
  let ui = states.get(container);
  const age = ctx.ageMonths();
  if (!ui) {
    ui={section:"plan",filter:"near",metric:"weight",sex:"",allLines:false,editMeasure:null,obsMonth:age===0 ? 0 : groupFor(age ?? 3),birth:null};
    states.set(container,ui);
  }
  const profile = ctx.profile();
  if (ui.birth!==profile.birthday) {
    ui.birth = profile.birthday;
    ui.filter="near"; ui.obsMonth=age===0 ? 0 : groupFor(age ?? 3); ui.sex=""; ui.editMeasure=null;
  }
  if (Object.prototype.hasOwnProperty.call(sections,ctx.healthSection)) ui.section=ctx.healthSection;
  if (Number.isInteger(ctx.healthMonth) && ctx.healthMonth>=0 && ctx.healthMonth<=12) {
    if (ui.section==="plan") ui.filter=String(ctx.healthMonth);
    if (ui.section==="observe") ui.obsMonth=ctx.healthMonth===0 ? 0 : groupFor(ctx.healthMonth);
    ctx.healthMonth=null;
  }
  if (ui.section==="observe" && ctx.healthMarkId) {
    ui.openMark=ctx.healthMarkId; ctx.healthMarkId="";
  }
  if (ui.section==="plan" && ctx.planAction==="custom") {
    ui.openCustom=true; ctx.planAction="";
  }
  if (ui.section==="measure" && ctx.measureAction==="new") {
    ui.editMeasure="new"; ctx.measureAction="";
  }
  if (ctx.healthVisitId) {
    const target=plans(ctx).find(p=>p.id===ctx.healthVisitId);
    if (target) {
      ui.section="plan";
      ui.filter=String(target.month);
      ui.openVisit=target.id;
    }
    ctx.healthVisitId="";
  }
  ui.draw = ()=>{
    const menu=el("div",{class:"health-tabs",role:"group","aria-label":"健康工具"});
    for (const [id,label] of Object.entries(sections)) menu.append(btn(label,()=>{
      if (ui.section===id) return;
      ui.section=id;ui.draw();
      if (globalThis.location?.hash?.startsWith("#growth")) location.hash="growth/"+id;
    },{"aria-pressed":ui.section===id}));
    const render={plan:planScreen,measure:measureScreen,observe:observeScreen}[ui.section];
    container.replaceChildren(el("div",{class:"health-tools"},menu,render(ctx,ui)));
  };
  ui.draw();
}
