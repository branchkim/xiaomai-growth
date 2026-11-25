import { bookResources } from "./book-resources.js";

export const guideId = "montessori-baby";
export const guideTitle = "蒙台梭利婴儿";
export const guideHash = "#journal/index?book=" + guideId;

// Chapter positions follow the public English table of contents. Prompts and
// card groupings are editorial links to Xiaomai's own home-practice library.
export const guideTopics = [
  { id: "start", label: "第 1 章", title: "认识眼前的宝宝", prompt: "刚开始带娃，今天可以先观察哪一件小事？", cards: ["mb-observe-pause", "edu-own-hands"] },
  { id: "approach", label: "第 2 章", title: "从观察开始理解蒙台梭利", prompt: "宝宝正专心时，大人怎样决定要不要加入？", cards: ["mb-observe-pause", "mb-follow-gaze", "edu-choose"] },
  { id: "arrival", label: "第 3 章", title: "从孕期到出生后六周", prompt: "迎接宝宝回家之前，家人可以一起准备什么？", cards: ["mb-setup-basket", "mb-rest-shift", "mb-visitor-hello"] },
  { id: "home", label: "第 4 章", title: "布置宝宝生活的地方", prompt: "家里哪块地面能留给宝宝？换片用品放哪儿顺手？", cards: ["edu-floor-space", "mb-setup-basket", "edu-low-shelf"] },
  { id: "together", label: "第 5 章", title: "和宝宝建立关系", prompt: "亲友想抱宝宝时，怎样先和宝宝打个招呼？", cards: ["mb-visitor-hello", "edu-diaper-talk", "edu-mirror-smile"] },
  { id: "activity", label: "第 6 章", title: "跟着兴趣选活动", prompt: "宝宝爱看、爱摸或爱把东西丢下去，可以怎样回应？", cards: ["mb-follow-gaze", "mb-drop-and-find", "edu-own-hands", "edu-pass", "edu-book"] },
  { id: "routine", label: "第 7 章", title: "在日常照护中一起做", prompt: "换片和穿衣时，哪一步可以留给宝宝参与？", cards: ["edu-diaper-talk", "edu-dress", "mb-setup-basket"] },
  { id: "adult", label: "第 8 章", title: "照护者也需要准备", prompt: "爸爸累了，怎样把手上的事交给另一位大人？", cards: ["mb-rest-shift", "edu-play-look"] },
  { id: "family", label: "第 9 章", title: "让家人一起参与", prompt: "爸妈和祖辈交班时，怎样说清刚才发生了什么？", cards: ["mb-family-ritual", "edu-play-look", "edu-wave-hello"] },
  { id: "toddler", label: "第 10 章", title: "从婴儿期走向幼儿期", prompt: "宝宝想自己动手时，哪一步已经可以交给他？", cards: ["mb-cup-return", "edu-low-shelf", "edu-diaper-helper"] },
  { id: "stories", label: "章后", title: "家庭实例", prompt: "用卡里的「我家的经验」，记下自己家的一次尝试。", cards: ["mb-family-ritual", "mb-visitor-hello", "mb-rest-shift"] },
  { id: "appendices", label: "书末", title: "附录", prompt: "想开始记观察？先试一张卡，再对照下方出版社的英文资料。", cards: ["mb-observe-pause", "edu-play-look"] },
];

const newPractices = ["mb-observe-pause", "mb-visitor-hello", "mb-setup-basket", "mb-rest-shift",
  "mb-family-ritual", "mb-follow-gaze", "mb-drop-and-find", "mb-cup-return"];
export const guideCardIds = [...new Set([...newPractices, ...guideTopics.flatMap(topic => topic.cards)])];

export function readGuide(params) {
  if (params.get("book") !== guideId) return null;
  return { topic: guideTopics.find(topic => topic.id === params.get("theme")) || null };
}

export function guideLink(params, topic) {
  const next = new URLSearchParams(params);
  next.set("book", guideId);
  if (topic) next.set("theme", topic.id);
  else next.delete("theme");
  return "#journal/index?" + next.toString();
}

export function setupGuide({ element, makeLink, external }) {
  const list = document.getElementById("guide-topics");
  const links = guideTopics.map(topic => {
    const link = makeLink(undefined, guideLink(null, topic), "guide-topic");
    const text = element("span");
    text.append(element("strong", topic.title), element("small", topic.prompt));
    link.append(element("span", topic.label, "guide-chapter"), text);
    list.append(link);
    return link;
  });
  const resources = document.getElementById("guide-resources");
  document.getElementById("guide-resource-label").textContent = "出版社配套资料（" + bookResources.length + "）";
  const groups = new Map();
  for (const item of bookResources) {
    if (!groups.has(item.group)) {
      const group = element("div", undefined, "guide-source-group");
      group.append(element("h3", item.group));
      groups.set(item.group, group);
      resources.append(group);
    }
    const link = external(item.label, item.url);
    const row = element("div", undefined, "guide-source");
    row.append(link, element("small", item.note));
    groups.get(item.group).append(row);
  }
  return (params) => {
    const active = readGuide(params);
    for (const [i, link] of links.entries()) {
      const topic = guideTopics[i];
      link.href = guideLink(params, topic);
      if (active?.topic === topic) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
    const selection = document.getElementById("guide-selection");
    selection.hidden = !active?.topic;
    if (active?.topic) {
      document.getElementById("guide-active-topic").textContent = active.topic.label + " · " + active.topic.title;
      document.getElementById("guide-all-topics").href = guideLink(params, null);
    }
  };
}
