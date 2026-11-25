import { bookReview } from "./book-review-data.js";

const normalized = text => text.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const sleepGuide = "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/A-Parents-Guide-to-Safe-Sleep.aspx";
const feedingGuide = "https://www.nhc.gov.cn/fys/c100078/202502/19903ff647694f3a85ed6fe332380b34.shtml";

export function searchReview(query) {
  const words = normalized(query).split(" ").filter(Boolean);
  return bookReview.map(chapter => ({
    chapter,
    sections: chapter.sections.filter(section => {
      const text = normalized([chapter.label, chapter.title, section.title, section.heading, section.finding, section.match].join(" "));
      return words.every(word => text.includes(word));
    }),
  })).filter(group => group.sections.length);
}

function makeReviewRow(section, { cards, element, makeLink }) {
  const item = element("li", undefined, "review-item");
  item.append(element("strong", section.title), element("small", section.match, "review-kind"));
  item.append(element("p", section.finding), element("small", "英文定位 · " + section.heading, "review-location"));
  if (section.match === "健康需核验") {
    const group = section.guidance;
    if (group === "sleep" || group === "feeding") {
      const note = group === "sleep"
        ? "让宝宝每次仰卧入睡，使用独立、平坦、坚实的婴儿睡面，保持睡面清空。"
        : "国内喂养指导建议从满 6 月龄起逐步添加辅食。早产或有喂养困难的宝宝，请和儿保医生商量。";
      item.append(element("p", note));
      const ref = makeLink(group === "sleep" ? "美国儿科学会 · 婴儿安全睡眠" : "国家卫健委 · 婴幼儿营养喂养评估", group === "sleep" ? sleepGuide : feedingGuide);
      ref.target = "_blank";
      ref.rel = "noreferrer";
      item.append(ref);
    }
  }
  for (const id of section.ids) {
    const card = cards.get(id);
    if (card) item.append(makeLink(card.title, "#card/" + id, "review-card"));
  }
  return item;
}

export function setupCrosswalk({ cards, element, makeLink }) {
  const list = document.getElementById("review-list");
  const input = document.getElementById("review-search");
  const counter = document.getElementById("review-count");
  function draw() {
    const groups = searchReview(input.value);
    const count = groups.reduce((total, group) => total + group.sections.length, 0);
    counter.textContent = count ? count + " 个对照条目" : "没有匹配的条目，可以换一个中文词或英文小节名。";
    const nodes = groups.map(({chapter, sections}) => {
      const group = element("details", undefined, "review-chapter");
      group.append(element("summary", chapter.label + " · " + chapter.title + "（" + sections.length + "）"));
      const render = () => {
        if (!group.open || group.querySelector("ol")) return;
        group.append(element("p", chapter.insight), element("p", "家庭尝试　" + chapter.practice));
        const items = element("ol");
        items.append(...sections.map(s => makeReviewRow(s, { cards, element, makeLink })));
        group.append(items);
      };
      group.addEventListener("toggle", render);
      group.open = !!input.value.trim() && (count <= 12 || groups.length === 1);
      if (group.open) render();
      return group;
    });
    list.replaceChildren(...nodes);
  }
  input.addEventListener("input", draw);
  draw();
}

export function appendBookSource(parent, cardId, { element, fold }) {
  const entries = [];
  for (const chapter of bookReview) {
    for (const ref of chapter.cardRefs.filter(ref => ref.id === cardId)) {
      const row = element("p");
      row.append(element("strong", chapter.label + " · " + ref.relationship),
        element("span", ref.remark), element("small", ref.section, "review-location"));
      entries.push(row);
    }
  }
  if (!entries.length) return;
  const panel = fold("这张卡和原书怎么对应", "fold review-refs");
  panel.append(...entries);
  parent.append(panel);
}
