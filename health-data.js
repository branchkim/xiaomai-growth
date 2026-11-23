// Public sources for the local reference material. Vaccine entries describe routine visits.
export const sources = {
  vaccines: ["国家疾控局 · 2026 年版儿童免疫程序", "https://www.ndcpa.gov.cn/jbkzzx/c100014/common/content/content_2073005020766703616.html"],
  visits: ["国家基本公共卫生服务规范 · 儿童健康管理", "https://www.nhc.gov.cn/ewebeditor/uploadfile/2017/04/20170417104506514.pdf"],
  optional: ["中国疾控中心 · 预防接种问答", "https://www.chinacdc.cn/jkyj/mygh02/yfjzfw/jzfw/202606/t20260617_1836820.html"],
  growth: ["国家卫健委 · WS/T 423—2022 附录 A", "https://www.nhc.gov.cn/fzs/c100048/202211/5001d7cf57774770a1d49c1df46a291f/files/1733125082501_81468.pdf"],
  marks: ["国家卫健委 · 婴幼儿心理行为发育标志自评表", "https://www.nhc.gov.cn/wjw/c100378/202502/658e7e4eb5024746b13186ac0f97a27b/files/1741749469944_58197.pdf"],
  flags: ["国家卫健委 · 儿童心理行为发育预警征象筛查表", "https://www.nhc.gov.cn/wjw/c100395/202302/1e15affdd2fa45e4a507136354161b66/files/1733795759650_44285.pdf"],
  rota: ["中国疾控中心收录 · 轮状病毒胃肠炎免疫预防共识", "https://www.chinacdc.cn/jkyj/crb2/bl/grxfxb/jswj_fxb/202409/P020240907592485015438.pdf"],
  localProducts: ["海阳市疾控中心 · 接种产品程序示例", "https://www.yantai.gov.cn/art/2022/9/13/art_93512_3021413.html"],
  flu: ["中国疾控中心 · 2026—2027 流感疫苗指南", "https://www.chinacdc.cn/jkyj/mygh02/jswj2026/202609/P020260902609797521311.pdf"],
  ev71: ["中国疾控中心 · EV-A71 疫苗接种提示", "https://www.chinacdc.cn/jkkp/crb/bcr/202610/t20261027_1842511.html"],
  combined: ["广安区卫生健康局 · 联合疫苗产品说明", "https://www.guanganqu.gov.cn/gaqrmzf/c114835/pc/content/content_1717584732968923136.html"],
  urgent: ["英国国家医疗服务体系 · 婴幼儿紧急就医信号", "https://www.nhs.uk/baby/health/when-to-get-urgent-medical-help-for-babies-and-children-under-5/"],
  newborn: ["世界卫生组织 · 新生儿危险信号", "https://www.who.int/news-room/fact-sheets/detail/newborn-mortality/"],
};

export const regular = [
  ["hepb-1", 0, "乙肝疫苗 · 第 1 剂", "常规在出生后 24 小时内接种。母亲乙肝表面抗原阳性或不详时，由产院在出生后 12 小时内尽早安排，并评估后续方案。"],
  ["bcg", 0, "卡介苗", "出生时接种，以接种证或出生医院记录为准。"],
  ["hepb-2", 1, "乙肝疫苗 · 第 2 剂"],
  ["ipv-1", 2, "脊灰灭活疫苗 · 第 1 剂"],
  ["dtap-1", 2, "百白破疫苗 · 第 1 剂"],
  ["ipv-2", 3, "脊灰灭活疫苗 · 第 2 剂"],
  ["bopv-3", 4, "脊灰减毒活疫苗 · 第 3 剂", "常规程序这一剂为口服 bOPV。采用全程灭活或联合疫苗时，请门诊核对已完成剂次。"],
  ["dtap-2", 4, "百白破疫苗 · 第 2 剂"],
  ["hepb-3", 6, "乙肝疫苗 · 第 3 剂"],
  ["dtap-3", 6, "百白破疫苗 · 第 3 剂"],
  ["men-a-1", 6, "A 群流脑多糖疫苗 · 第 1 剂"],
  ["mmr-1", 8, "麻腮风疫苗 · 第 1 剂"],
  ["je-1", 8, "乙脑疫苗 · 第 1 剂", "请按门诊或接种证记录制剂。8 月龄使用减毒活制剂时接种 1 剂，使用灭活制剂时接种 2 剂，两剂间隔 7–10 天。"],
  ["men-a-2", 9, "A 群流脑多糖疫苗 · 第 2 剂", "通常在 9 月龄接种，与第 1 剂间隔至少 3 个月。"],
].map(([id, month, title, detail = "核对接种证，按门诊确认的时间前往。"]) => ({id, month, title, detail, kind:"vaccine"}));

export const checkups = [
  ["home-visit", 0, "新生儿家庭访视", "通常在出院后一周内由基层医务人员访视。具体日期请按出院安排填写。"],
  ["check-1", 1, "满月儿保", "带上母子健康手册和预防接种证，和医生聊聊吃奶、睡眠及出院后的变化。"],
  ["check-3", 3, "3 月龄儿保", "带上近期身长、体重记录，和医生聊聊宝宝看人脸、回应声音及抬头的变化。"],
  ["check-6", 6, "6 月龄儿保", "就诊时可一起回顾喂养、生长、听声反应及伸手取物的表现。"],
  ["check-8", 8, "8 月龄儿保", "可以带上喂养记录，聊聊坐姿、换手拿玩具或辨认熟人的表现。"],
  ["check-12", 12, "周岁儿保", "和医生一起看全年的生长记录，回顾听名反应、模仿动作及扶站的变化。"],
].map(([id,month,title,detail])=>({id,month,title,detail,kind:"checkup"}));
export const optionalVaccines = [
  {id:"rv5",title:"五价轮状病毒疫苗（RV5）",prevents:"预防所含型别轮状病毒引起的婴幼儿胃肠炎。",timing:"口服 3 剂。6–12 周龄开始，两剂相隔 4–10 周，末剂须在 32 周龄内完成。其他轮状病毒产品有各自的年龄窗口。",source:"rota"},
  {id:"pcv13",title:"13 价肺炎球菌结合疫苗",prevents:"预防疫苗所含血清型肺炎球菌引起的侵袭性感染。",timing:"部分产品在 2、4、6 月龄各接种 1 剂，12–15 月龄加强 1 剂。较晚开始时，所需剂数随产品和起始年龄而变。",source:"localProducts"},
  {id:"hib",title:"b 型流感嗜血杆菌（Hib）疫苗",prevents:"预防 Hib 引起的严重感染，包括脑膜炎和肺炎。",timing:"以一种单独的 Hib 疫苗为例，满 2 至未满 6 月龄开始需 3 剂基础免疫，满 6 至未满 12 月龄开始需 2 剂，约 18 月龄加强 1 剂。已打联合疫苗时由门诊核对。",source:"localProducts"},
  {id:"flu",title:"婴幼儿灭活流感疫苗",prevents:"预防季节性流感，降低流感重症风险。",timing:"2026—2027 流感季，满 6 月龄且从未接种流感疫苗的婴儿，通常需 2 剂同厂家同种灭活疫苗，间隔至少 4 周。既往接种过时当季通常 1 剂。",source:"flu"},
  {id:"ev71",title:"肠道病毒 71 型灭活疫苗",prevents:"针对 EV-A71 引起的手足口病；其他肠道病毒也可引起手足口病。",timing:"满 6 月龄起可向门诊咨询，基础程序共 2 剂，相隔约 1 个月，鼓励在 12 月龄前完成。",source:"ev71"},
  {id:"combined",title:"五联疫苗（百白破、脊灰、Hib）",prevents:"覆盖百日咳、白喉、破伤风、脊灰，以及 Hib 引起的感染。",timing:"一种产品程序是 2、3、4 月龄各 1 剂，18 月龄加强 1 剂。请门诊核对可计入国家免疫程序的剂次，避免重复预约。",source:"combined"},
];

export const observationGroups = [
  { month:3, marks:[
    ["head-up","被抱直时，小脑袋能稳一会儿"],
    ["hold","把玩具放进手里，会握住一会儿"],
    ["coo","有人说话时，会咿呀回应"],
    ["look-sound","听见声音，会用眼睛寻找"],
    ["smile","看到家人微笑，会回一个笑"],
  ], flags:["平常环境中对很响的声音也没有反应。","面对逗引，听不到宝宝发声或没见过微笑。","目光很少停在人脸上，也不追随移动的人或物。","清醒、有人看护的俯卧时间里，仍不能抬头。"] },
  { month:6, marks:[
    ["sit-assisted","双手撑着，也能短暂坐一会儿"],
    ["pass","玩具会从一只手换到另一只手"],
    ["turn-name","听到自己的名字，会转向声音"],
    ["find-dropped","东西掉了，会用目光寻找"],
    ["recognise","遇见熟人和陌生人时，反应有区别"],
  ], flags:["很少发声，也听不到笑出声。","面前有玩具也不伸手去拿。","手总是紧攥着，很难舒展开。","有人扶着躯干时，仍坐不住。"] },
  { month:8, marks:[
    ["crawl","趴着时能贴着垫面向前挪动"],
    ["tap","会把两只手里的玩具碰一碰"],
    ["babble","会连着发出几个相似音节"],
    ["detail","开始注意衣服图案上的小细节"],
    ["stranger","见到陌生人时显得有点怕生"],
  ], flags:["听到身边的声音仍不见回应。","对熟人和陌生人一直没有明显区别。","玩具仍不能在两手间换手。","还不能自己坐稳。"] },
  { month:12, marks:[
    ["stand","松开扶着的东西，也能站几秒"],
    ["place","能对准容器开口，把手中物品放进去"],
    ["understand","听到熟悉物品的名字，会看向它"],
    ["imitate","能跟着家人学拍手等动作"],
    ["expression","会留意家人的表情，并作出回应"],
  ], flags:["在日常环境中呼唤名字，宝宝一直没有反应。","还不会模仿挥手再见或拍手欢迎。","日常抓握中看不到拇指和食指对捏的动作。","扶着稳固的物体仍站不起来。"] },
];
export const metrics = {
  weight:{ title:"体重", unit:"kg", step:"0.001" },
  length:{ title:"身长", unit:"cm", step:"0.1" },
  head:{ title:"头围", unit:"cm", step:"0.1" },
};
