// File order follows the OPF spine in the family's English EPUB (2021).
// Entries describe the book. The reader gets text and pictures from a local copy.
export const readerGroups = [
  { id: "begin", title: "理解宝宝" },
  { id: "care", title: "在家一起生活" },
  { id: "grow", title: "家人和成长" },
  { id: "reference", title: "查表与书目信息" },
];

function parts(first, labels) {
  return labels.map((label, index) => ({
    href: "index_split_" + String(first + index).padStart(3, "0") + ".html",
    label,
  }));
}

export const readerChapters = [
  { id: "opening", title: "封面、献词与目录", group: "begin",
    intro: "从封面和书名页认识两位作者与插画者。原书目录里的小节名可以直接点开，适合手头有一个具体问题时查读。",
    files: [{ href: "titlepage.xhtml", label: "封面" }, ...parts(0, ["书名页", "献词", "原书目录"])] },
  { id: "start", title: "第 1 章 · 重新认识宝宝", group: "begin",
    intro: "两位作者从各自带宝宝、陪伴家庭的经历讲起。读这一章时，可以想想今天有没有一个瞬间，宝宝用眼神或动作参与了你正在做的事。",
    files: parts(3, ["本章目录", "正文"]) },
  { id: "approach", title: "第 2 章 · 蒙台梭利的基本想法", group: "begin",
    intro: "这章把吸收性心智、敏感期、观察和环境准备放回宝宝的日常生活。读到观察练习时，可以对照自己刚看见的动作和自己对那个动作的解释。",
    files: parts(5, ["本章目录", "正文与观察练习"]) },
  { id: "arrival", title: "第 3 章 · 从孕期到出生后的最初几周", group: "begin",
    intro: "从准备迎接孩子，到新生儿与家人逐渐熟悉彼此，本章串起了孕期、出生和回家后的转变。家人可以一起读读关于探望、减轻家务和建立联系的部分。",
    files: parts(7, ["章首插图", "本章目录", "正文与访谈"]) },
  { id: "home", title: "第 4 章 · 给宝宝布置一个家", group: "care",
    intro: "沿着宝宝的视线看看房间，书里哪些东西他看得见、能够到？本章还讨论了小户型、兄弟姐妹共用空间，以及在家里留出可以安心探索的角落。",
    files: parts(10, ["本章目录", "正文与家庭空间实例"]) },
  { id: "together", title: "第 5 章 · 和宝宝建立关系", group: "care",
    intro: "从抱起宝宝前的一句招呼，到宝宝专心时大人怎样等待，本章用日常互动谈尊重、信任和界限。可以挑一个你每天都会遇到的场景来读。",
    files: parts(12, ["本章目录", "正文与亲子互动举例"]) },
  { id: "activity", title: "第 6 章 · 跟着兴趣选活动", group: "care",
    intro: "这一章分为活动准备、语言、动作和其他活动。宝宝最近爱听家人说话，或喜欢把东西从一只手换到另一只手，都可以成为选读的起点。",
    files: parts(14, ["本章目录", "活动准备", "语言活动", "动作活动", "音乐、自然等活动", "插图"]) },
  { id: "routine", title: "第 7 章 · 一天里的照护", group: "care",
    intro: "换衣、换片、吃饭和出门这些重复发生的事，构成了这一章的主线。原书也讨论睡眠和喂养，想把其中的想法用在自家宝宝身上时，可以参看小麦对照里列出的照护指南。",
    files: parts(20, ["本章目录", "日常节奏", "身体照护", "常见问题", "不同家庭情境"]) },
  { id: "adult", title: "第 8 章 · 照护者的准备", group: "grow",
    intro: "这一章把目光转向大人自己，讨论如何腾出精力、察觉情绪和寻找支持。那些帮助照护者平静下来的例子，可以和伴侣一起看，再挑适合自己家的一种。",
    files: parts(25, ["章首插图", "本章目录", "正文与照护者练习"]) },
  { id: "family", title: "第 9 章 · 和其他照护者合作", group: "grow",
    intro: "当父母、祖辈或其他照护者轮流带娃，交接和意见分歧都变得很具体。本章谈怎样协商、选择照护支持，也谈离开前如何好好道别。",
    files: parts(28, ["本章目录", "正文与家庭合作"]) },
  { id: "toddler", title: "第 10 章 · 走向幼儿期", group: "grow",
    intro: "宝宝开始表达自己的意愿以后，大人的帮助也需要跟着变。本章从婴儿向幼儿的过渡写起，把眼光放到更长的成长过程中。",
    files: parts(30, ["本章目录", "正文"]) },
  { id: "stories", title: "六个家庭与一间亲子课堂", group: "grow",
    intro: "六个家庭和荷兰的一组亲子课堂讲述自己的尝试。带着同一个问题读不同故事，可以看到各家怎样根据住处、文化和孩子的兴趣作调整。",
    files: parts(32, ["实例导言", "在新西兰生活的家庭", "英国家庭", "美国家庭", "在日本生活的多哥家庭", "在美国生活的西班牙家庭", "尼日利亚家庭", "荷兰亲子课堂"]) },
  { id: "appendices", title: "附录 · 月龄资料与活动图表", group: "reference",
    intro: "可以在这里回看分龄观察、活动图表、原始反射资料和延伸阅读。活动图连同图里的英文保留在原文中，方便和前面章节里的描述对照。",
    files: parts(40, ["附录目录", "月龄资料、活动图表与延伸阅读"]) },
  { id: "credits", title: "线上资源、作者与版权", group: "reference",
    intro: "书末收录了出版社配套资料的说明、作者介绍和本版版权信息。需要核对英文书名、作者或电子书版本时，可以从这里查起。",
    files: parts(42, ["线上资源", "作者介绍", "版权页"]) },
];
