import { bookReview } from "./book-review-data.js";
import { bookResources } from "./book-resources.js";

export const guideId = "montessori-baby";
export const guideTitle = "蒙台梭利婴儿";
export const guideHash = "#journal/index?book=" + guideId;

// Each featured card has an individually checked reference in the English EPUB.
export const guideTopics = bookReview.map(chapter => ({
  id: chapter.id,
  label: chapter.label,
  title: chapter.title,
  prompt: chapter.insight,
  cards: [...new Set(chapter.cardRefs.map(ref => ref.id))],
}));

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
