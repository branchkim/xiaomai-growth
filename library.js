// The seven journal chapters and the activity age windows answer different questions.
export function ageWindow(activity) {
  return activity.window[0] + " 至未满 " + activity.window[1] + " 月龄";
}

export function availableFilters(data) {
  const unique = (values) =>
    [...new Set(values.filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "zh-CN"),
    );
  return {
    stage: data.stages.map((s) => [s.id, s.label]),
    age: [
      ...new Map(
        data.cards
          .filter((c) => c.activity)
          .map((c) => [c.activity.window.join("-"), c.activity]),
      ).values(),
    ]
      .sort((a, b) => a.window[0] - b.window[0])
      .map((a) => [a.window.join("-"), ageWindow(a)]),
    topic: unique(data.cards.map((c) => c.topic)).map((x) => [x, x]),
    scene: unique(data.cards.flatMap((c) => [c.scene, c.activity?.scene])).map(
      (x) => [x, x],
    ),
    lens: unique(data.cards.map((c) => c.activity?.lens)).map((x) => [x, x]),
  };
}

const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "");
export function makeSearchIndex(data) {
  const stageNames = new Map(
    data.stages.map((s) => [s.id, s.label + " " + s.name]),
  );
  return data.cards.map((card) => {
    const a = card.activity || {};
    const groups = [
      [card.title, a.title],
      card.aliases,
      [
        card.topic,
        card.scene,
        a.scene,
        a.lens,
        stageNames.get(card.stage),
        a.window && ageWindow(a),
      ],
      [
        a.materials,
        a.signal,
        card.reason,
        ...card.steps,
        a.reason,
        ...(a.steps || []),
        a.stop,
      ],
    ];
    return {
      card,
      fields: groups.map((group) => group.filter(Boolean).map(normalize)),
    };
  });
}

export function findCards(index, filters) {
  const terms = (filters.q || "")
    .trim()
    .split(/[\s，、,]+/u)
    .map(normalize)
    .filter(Boolean);
  const matches = [];
  for (const entry of index) {
    const { card, fields } = entry,
      activity = card.activity || {};
    if (filters.stage && filters.stage !== card.stage) continue;
    if (filters.age && filters.age !== activity.window?.join("-")) continue;
    if (filters.topic && filters.topic !== card.topic) continue;
    if (filters.scene && ![card.scene, activity.scene].includes(filters.scene))
      continue;
    if (filters.lens && filters.lens !== activity.lens) continue;
    let score = 0;
    for (const term of terms) {
      const group = fields.findIndex((values) =>
        values.some((value) => value.includes(term)),
      );
      if (group < 0) {
        score = -1;
        break;
      }
      score += [12, 10, 6, 2][group];
    }
    if (score >= 0) matches.push({ card, score });
  }
  return matches.sort((a, b) => b.score - a.score).map((result) => result.card);
}
