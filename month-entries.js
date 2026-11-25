import { includesMonth } from "./library.js";

// IDs match the full activity cards. Their age windows and detailed instructions
// stay in cards.json; editing short copy never changes a family's record key.
function activity(title, how, observation, material) {
  return { title, how, observation, material };
}

export const gameCopy = {
  "edu-diaper-talk": activity(
    "换片时面对面说话", "趁宝宝清醒，先让他看见你的脸，再说「我帮你换尿布啦」，停一停。",
    "目光在家人的脸上停了一会儿", "手边的换片用品"),
  "edu-humming": activity(
    "轻哼家乡小调", "坐稳托好宝宝的头颈，露出口鼻，轻哼两句，再停下来听一听。",
    "听见熟悉的声音时，动作停了一下", "家人的声音"),
  "card-21": activity(
    "接一句宝宝的「啊」", "听见宝宝发声，就用家乡话轻轻回一句，等他再接话。",
    "家人停下说话后又发了一声", "家人的声音"),
  "edu-dress": activity(
    "穿衣时等一等", "拢好袖口，说「轮到这只手啦」，等宝宝动一动再帮他穿。",
    "穿袖子时自己动了动手臂", "一件宽松的衣服"),
  "edu-own-hands": activity(
    "一起看看小手", "宝宝清醒时仰躺在地垫上，你在旁陪着，留点时间让他看自己的手。",
    "注视自己的手或让两只手碰在一起", "平整稳固的地垫"),
  "edu-mirror-smile": activity(
    "回一个微笑", "面对面坐好或抱稳。宝宝扬起嘴角时，你也笑一笑，等他回应。",
    "看见家人笑，自己也扬起了嘴角", "一张熟悉的脸"),
  "card-24": activity(
    "伸手摸软布", "把软布放到手边，等宝宝伸手；差一点够到时再挪近，玩后收起。",
    "伸手碰到软布，抓住了布边", "一块干净、没有松线的软布"),
  "edu-choose": activity(
    "只留一件玩具", "腾空一小块地垫，放一件宝宝熟悉的大玩具，看他先盯住哪里。",
    "目光停在玩具上，伸出手去摸", "完好、整件不能入口的婴儿玩具"),
  "edu-floor-space": activity(
    "在地垫上伸伸腿", "清开热杯、电线和小物件。宝宝清醒时仰躺在垫上，你在旁陪他自由活动。",
    "在垫上主动伸腿或转头看一侧", "稳固平整的地垫"),
  "edu-play-look": activity(
    "看他再玩一遍", "等宝宝自己重复一个动作。交班时只说你看到的，比如「他摸了两次书角」。",
    "自己又重复了一次刚才的动作", "宝宝正摆弄的安全物品"),
  "edu-spoon-sounds": activity(
    "用勺子敲敲碗", "宝宝坐稳后，拿软勺轻碰空碗，再把勺递给他。桌边收走热食。",
    "拿起勺子碰了碰碗", "不易碎的空碗和一体式大软勺"),
  "edu-pass": activity(
    "握环换只手", "坐在宝宝身旁，让他自己握住大环，留出另一只手摸环的空间。",
    "把手里的握环递到了另一只手", "无小零件的大号婴儿握环"),
  "edu-cloth-pages": activity(
    "摸一摸布书", "你扶好书脊，让宝宝自己拍一拍、摸一摸喜欢的那一页。",
    "自己去摸布书，或掀起了页角", "无松线、无可拆装饰的布书"),
  "edu-doorway-words": activity(
    "下楼认树叶", "抱稳宝宝或停好童车，顺着他的目光说出一样东西，比如「树叶在动」。",
    "多看了一眼家人说到的东西", "路边看得见的树叶或车辆"),
  "edu-book": activity(
    "读喜欢的那一页", "宝宝停在哪一页，就指着一幅图说个名字，等他再看或翻页。",
    "主动翻回或摸了摸喜欢的那一页", "一本圆角纸板书或布书"),
  "edu-wave-hello": activity(
    "挥手打招呼", "家人进门时，站在宝宝看得见的地方挥一下手，等他的回应。",
    "看到家人挥手时有了回应", "刚进门的家人"),
  "edu-low-shelf": activity(
    "自己取水杯", "把轻巧的空杯放在不用攀爬就能拿到的固定位置，用完和孩子一起放回。",
    "在熟悉的位置找到并拿起了水杯", "不易碎的空杯和稳固矮架"),
  "edu-diaper-helper": activity(
    "帮忙拿片尿布", "留一片干净尿布在矮篮里，伸手说「请帮我拿一片」，等孩子递过来。",
    "听见请求后从篮里拿出了尿布", "敞口矮篮和干净尿布"),
  "edu-wipe-place": activity(
    "擦掉小水印", "移走热菜和清洁剂，你先擦一半水印，再把拧干的小布交给孩子。",
    "用布在桌面上来回擦了擦", "小布和一小处清水印"),
  "edu-sock-pairs": activity(
    "给袜子配一双", "摊开两双花色不同的干净袜子，你拿一只，等孩子找出它的伙伴。",
    "自己选出两只相像的袜子放在一起", "两双无小装饰的干净袜子"),
  "edu-two-shirts": activity(
    "自己挑件外套", "两只手各拿一件适合天气的外套，让孩子用看、指或说来选择。",
    "用目光、手指或话语选了外套", "两件都合身的应季外套"),
  "edu-open-box": activity(
    "打开再盖上", "把空盒放稳，留给孩子自己找盖边、掀开，再试着盖回去。",
    "一手扶住盒身，另一手掀开盖子", "带整片大盖、无夹手铰链的空盒"),
  "edu-turn-ball": activity(
    "面对面滚球", "在远离台阶的平地相对坐好，把大软球滚给孩子，等他送回来。",
    "把滚来的球推回给对面的人", "没有小配件的大软球"),
  "edu-set-table": activity(
    "帮家人放餐巾", "上热菜前，你在自己座位前放一条餐巾，再请孩子给另一位家人也放一条。",
    "给另一个座位放上了一条餐巾", "两三条干净布餐巾"),
  "edu-shoe-time": activity(
    "自己按上鞋扣", "让孩子坐稳，帮他穿好需要帮助的部分，把最后一个粘扣留给他。",
    "用手把鞋上的粘扣按好了", "合脚的粘扣鞋和地垫"),
  "edu-wash-veg": activity(
    "一起洗根黄瓜", "在远离灶火的矮桌放浅盆，大人全程在旁，让孩子用少量清水搓洗整根黄瓜。",
    "一手扶住黄瓜，一手搓了搓", "完整黄瓜和一浅盆常温水"),
  "edu-small-pour": activity(
    "倒一小杯水", "小壶里放少量常温水，示范让壶嘴靠近杯口，请孩子试着倒入再扶正。",
    "看着杯里的水，自己扶正了壶", "轻便小壶、宽口杯和抹布"),
  "edu-napkin-fold": activity(
    "方巾对折一次", "并排摊好两条方巾，你把近端翻过去压平，留孩子自己折另一条。",
    "把方巾一边翻到另一边并压平", "两条无绳带的方巾"),
  "edu-story-retell": activity(
    "讲讲今天的小事", "拿出今天用过的方巾，请孩子把刚才做的事讲给回家的家人听。",
    "用动作或词语讲起今天的一件事", "今天一起用过的一件物品"),
  "edu-pretend-market": activity(
    "在家开菜摊", "在矮桌上摆两样玩具菜，请孩子当摊主，你挑一样，再轮流换角色。",
    "用指、拿或说和家人扮演买卖", "两张大幅蔬菜图片和布袋"),
};

export function familyObservations(month, cards) {
  return cards
    .filter((card) => includesMonth(card.activity?.window, month) && gameCopy[card.id])
    .map((card) => {
      const copy = gameCopy[card.id];
      return {
        id: "family-" + card.id,
        title: copy.observation,
        how: copy.how,
        cardId: card.id,
      };
    });
}

// Each upper bound is the next completed month, as in the card library.
const stages = [
  { until: 1, tip: "趁清醒时看看脸、听听家人的声音，困了就歇。",
    material: { title: "画一张黑白条纹卡", how: "用深色笔在白纸上画几道宽条纹，大人拿在手里给清醒的宝宝看。", safety: "纸和笔由大人保管，玩完收起，睡眠区保持清空。" } },
  { until: 3, tip: "穿衣或换片时慢一点，给宝宝留出接话、伸手的工夫。",
    material: { title: "把袖口当提示", how: "穿衣前把衣袖拢到手中，先让宝宝看见，再告诉他要穿哪只手。", safety: "大人托稳头颈，衣物和布料远离口鼻。" } },
  { until: 6, tip: "在地垫留一小块空处，让宝宝伸手摸自己感兴趣的东西。",
    material: { title: "家里的触感布", how: "选一块干净的棉布，把一角放到宝宝伸手能碰到的位置。", safety: "先检查松线和可脱落装饰，成人在旁，玩完收起。" } },
  { until: 9, tip: "把一件拿得住的东西放在手边，等宝宝自己摸、传或轻敲。",
    material: { title: "一只碗的小乐器", how: "取一只轻碗和一把大软勺，示范在空碗边轻轻敲一下。", safety: "选不易碎的碗勺，收开热汤，陪宝宝坐稳。" } },
  { until: 12, tip: "跟着宝宝的目光说名字，挥手和翻书都给他留一回合。",
    material: { title: "窗边找一找", how: "和宝宝在安全位置看看窗外，他望向什么就跟他说什么。", safety: "抱稳宝宝，远离窗台和窗绳。" } },
  { until: 18, tip: "让孩子参与一小步家务，拿尿布、取杯子都可以。",
    material: { title: "一篮干净尿布", how: "用敞口矮篮装一两片干净尿布，让孩子站稳就能够到。", safety: "篮里只放干净尿布，护理用品另收好。" } },
  { until: 24, tip: "给两样东西让孩子选，也试试配袜子或轮流滚球。",
    material: { title: "两双袜子的配对盘", how: "取两双花色差别大的袜子散放在平地，一起找同伴。", safety: "取下包装，选没有珠扣等小装饰的干净袜子。" } },
  { until: 30, tip: "穿鞋、摆餐巾时留一个步骤，让孩子自己做完。",
    material: { title: "摆桌的小帮手", how: "把干净餐巾放在孩子够得着的桌边，一起找哪些座位还空着。", safety: "先完成摆放，再由大人端热菜上桌。" } },
  { until: 36, tip: "一起倒水、折方巾，把今天的小事讲给家人听。",
    material: { title: "家庭小菜摊", how: "在两张大纸上各画一种蔬菜，配个敞口篮，就可以轮流买菜。", safety: "大人收好剪刀，纸卡保持完整。" } },
];

const stageFor = (month) => Number.isInteger(month) && month >= 0 && stages.find((stage) => month < stage.until);
export const monthTip = (month) => stageFor(month)?.tip || "";
export const monthMaterial = (month) => stageFor(month)?.material || null;

const fever = { title: "英国国家医疗服务体系 · 儿童发热", url: "https://www.nhs.uk/symptoms/fever-in-children/" };
const emergency = { title: "北京佑安医院 · 哪些情况要马上就医", url: "https://wjw.beijing.gov.cn/bmfw_20143/jkzs/jksh/202512/t20251216_4344983.html" };
const jaundice = { title: "首都儿科研究所 · 新生儿黄疸", url: "https://wjw.beijing.gov.cn/bmfw_20143/jkzs/jksh/202306/t20230626_3146401.html" };
const development = { title: "国家卫生健康委 · 婴幼儿心理行为发育标志自评表", url: "https://www.nhc.gov.cn/wjw/c100378/202502/658e7e4eb5024746b13186ac0f97a27b/files/1741749469944_58197.pdf" };
const nappy = { title: "英国国家医疗服务体系 · 尿布区皮肤护理", url: "https://www.nhs.uk/baby/caring-for-a-newborn/nappy-rash/" };

// Use the nearest *completed* national self-assessment checkpoint for a
// conversation with the clinic. Home games have no medical pass/fail score.
const clinicExamples = [
  [30, "怎样回答简单的问题、和家人轮流玩"],
  [24, "怎样翻书、说短句或玩假装游戏"],
  [18, "平时会用哪些词、怎样参与传球"],
  [12, "听到熟悉物品名字时的反应、模仿家人的动作"],
  [8, "宝宝怎样敲玩具、发出重复音节"],
  [6, "听见自己名字时的反应、玩具怎样在手里传"],
  [3, "和家人面对面说话时的声音和表情"],
];

export function safetyGroups(month) {
  if (!stageFor(month)) return [];
  const urgent = [
    { title: "呼吸明显费力、口唇发青", how: "立即拨打 120。" },
    { title: "叫不醒，或第一次抽搐", how: "立即寻求急救，拨打 120。" },
  ];
  if (month < 3) urgent.push({ title: "未满 3 个月，体温达到 38°C", how: "立即联系儿科就医评估，即使宝宝看起来精神还好。" });
  else if (month < 6) urgent.push({ title: "满 3 至未满 6 个月，体温达到 39°C", how: "立即联系儿科就医评估。出现呼吸困难或叫不醒时拨打 120。" });

  const checkpoint = clinicExamples.find(([age]) => month >= age);
  const consult = !checkpoint
    ? { level: "consult", title: "今天就联系儿科", items: [
      { title: "大便发灰、发白或像陶土", how: "及时就医。可以拍下便色给医生看。" },
      { title: "皮肤或眼白黄得更明显，或退了又黄", how: "请儿科医生评估，别等到下次体检。" },
    ], source: jaundice }
    : { level: "consult", title: "尽早向儿保医生咨询", items: [
      { title: "满 " + checkpoint[0] + " 个月的儿保自评有疑问", how: "带上儿保手册，和医生聊聊" + checkpoint[1] + "。" },
    ], source: development };
  return [
    { level: "urgent", title: "马上就医", items: urgent, source: month < 6 ? fever : emergency },
    consult,
    { level: "routine", title: "在家可以做", items: [
      { title: "尿布区轻微发红", how: "及时换尿布，用清水轻轻洗净、拍干。如果红疹变重、扩散或伴发热，请联系医生。" },
    ], source: nappy },
  ];
}
