import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { monthlyDate, ageAt, percentileBand, makeCalendar, healthReport, healthToday } from "../health.js";
import { growth, percentiles } from "../health-growth.js";
import { regular, checkups, observationGroups } from "../health-data.js";

const cards = JSON.parse(readFileSync(new URL("../cards.json",import.meta.url),"utf8")).cards;

function context(age, rows = {}, profile = {}) {
  return {
    cards,
    ageMonths: () => age,
    profile: () => ({birthday:"2024-01-31",reminders:{},...profile}),
    store: {list: type => rows[type] || []},
  };
}

test("calendar-month anniversaries clamp to month end, including leap days",()=>{
  assert.equal(monthlyDate("2024-01-31",1),"2024-02-29");
  assert.equal(monthlyDate("2023-01-31",1),"2023-02-28");
  assert.equal(ageAt("2024-01-31","2024-02-29"),1);
  assert.equal(ageAt("2024-02-29","2025-02-28"),12);
  assert.equal(ageAt("2024-02-29","2024-02-29"),0);
  assert.equal(ageAt("2024-02-31","2024-04-01"),null);
  assert.equal(ageAt("2024-02-29","2024-02-28"),null);
  assert.equal(ageAt("2024-04-15","2024-04-30"),0.5);
});

test("WS/T 423 appendix A has 7 percentiles for all 13 ages, sexes and measures",()=>{
  assert.deepEqual(percentiles,[3,10,25,50,75,90,97]);
  for (const sex of ["female","male"]) {
    for (const metric of ["weight","length","head"]) {
      const rows = growth[sex][metric];
      assert.equal(rows.length,13);
      for (const row of rows) {
        assert.equal(row.length,7);
        assert(row.every((x,i)=>Number.isFinite(x) && (i===0 || x>row[i-1])));
      }
    }
  }
  // Cross-check appendix A.1, A.2, A.3, A.4, A.11, A.12 at birth / one year.
  assert.deepEqual([growth.male.weight[0][3],growth.female.weight[12][3]],[3.5,9.4]);
  assert.deepEqual([growth.male.length[0][3],growth.female.length[12][3]],[51.2,75.2]);
  assert.deepEqual([growth.male.head[0][3],growth.female.head[12][3]],[34.3,45.1]);
});

test("percentile estimate uses adjacent bounds, includes edge equality and avoids extrapolation",()=>{
  const rows=growth.female.weight;
  for(const [age,value,expected] of [
    [0,1,"低于 P3"],[0,2.7,"约 P3"],[0,4.1,"约 P97"],[12,12,"高于 P97"],
    [12,9.4,"约 P50"],[3,6.25,"约 P50–P75"],[3.5,6.55,"约 P50"],
    [13,6,""],[-1,6,""],[null,6,""],[3,NaN,""],
  ]) assert.equal(percentileBand(rows,age,value),expected);
  assert.equal(percentileBand(undefined,3,6),"");
});

test("ICS reminders span one local calendar day, include selected alarms and fold UTF-8 correctly",()=>{
  const title="自定义".repeat(40)+"\n下一行,地点;门诊\\A";
  const bytes=makeCalendar("visit-7",title,"2026-12-31",3);
  assert(bytes.includes("DTSTART;VALUE=DATE:20261231\r\n"));
  assert(bytes.includes("DTEND;VALUE=DATE:20270101\r\n"));
  assert(bytes.includes("TRIGGER:-P3D\r\n"));
  assert(bytes.includes("UID:visit-7@xiaomai.local\r\n"));
  assert(bytes.split("\r\n").every(line=>Buffer.byteLength(line)<=75));
  const unfolded=bytes.replace(/\r\n /g,"");
  assert(unfolded.includes("\\n下一行\\,地点\\;门诊\\\\A"));
  assert(makeCalendar("visit","儿保","2024-02-29",0).includes("TRIGGER:PT0S"));
  assert.throws(()=>makeCalendar("visit","儿保","2026-02-29"));
});

test("routine schedule reflects 2026 programme and child-health visits",()=>{
  const doses=prefix=>regular.filter(r=>r.id.startsWith(prefix)).map(r=>r.month);
  assert.deepEqual(doses("dtap-"),[2,4,6]);
  assert.deepEqual(doses("hepb-"),[0,1,6]);
  assert.deepEqual(doses("ipv-"),[2,3]);
  assert.deepEqual(doses("bopv-"),[4]);
  assert.deepEqual(doses("men-a-"),[6,9]);
  assert.deepEqual(checkups.map(r=>r.month),[0,1,3,6,8,12]);
  assert.equal(observationGroups.reduce((total,g)=>total+g.marks.length,0),20);
});

test("home returns the same record IDs used by the plan, milestone form and report",()=>{
  const ctx=context(3);
  const next=healthToday(ctx);
  assert.equal(next.plan.visitId,"ipv-2");
  assert.equal(next.observation.milestoneId,"mark-3-head-up");
  const mark={id:next.observation.milestoneId,date:"2024-04-30",note:"抱着看窗外时"};
  const updated=context(3,{milestone:[mark],visit:[{id:"ipv-2",actual:"2024-04-30"}]});
  assert.equal(healthToday(updated).plan.visitId,"check-3");
  assert.equal(healthToday(updated).observation.milestoneId,"mark-3-hold");
  assert(healthReport(updated).includes("首次 2024-04-30 · 抱着看窗外时"));
  assert.equal(healthToday(context(0)).observation.milestoneId,undefined);
});

test("home games respect completed-month windows and family preferences",()=>{
  for (const age of [0,1,2,3,5,6,8,9,11]) {
    const item=healthToday(context(age)).activity;
    const card=cards.find(c=>c.id===item?.cardId);
    assert(card && card.activity.window[0]<=age && age<card.activity.window[1]);
  }
  assert.deepEqual(healthToday(context(6,{}, {reminders:{plan:false,observation:false,activity:false}})),{});
  assert.equal(healthToday(context(null,{}, {birthday:""})).activity,undefined);
});

test("report preserves actual and booked dates, product course, measurements and notes",()=>{
  const ctx=context(8,{
    measurement:[{id:"m1",date:"2024-08-01",weight:8.2,length:68.1,head:43.2}],
    visit:[{id:"je-1",actual:"2024-09-30",course:"inactive"},
      {id:"je-2",appointment:"2024-10-07",note:"儿保门诊"}],
  });
  const report=healthReport(ctx);
  assert(report.includes("体重 8.2 kg，身长 68.1 cm，头围 43.2 cm"));
  assert(report.includes("灭活制剂 · 实际 2024-09-30"));
  assert(report.includes("乙脑灭活疫苗 · 第 2 剂 · 预约 2024-10-07 · 儿保门诊"));
  assert(!healthReport(context(8,{visit:[{id:"je-1",actual:"2024-09-30",course:"live"}]})).includes("乙脑灭活疫苗 · 第 2 剂"));
});
