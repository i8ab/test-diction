/**
 * Unit → Section → Lesson structure for the Baccalaureate Curriculum section.
 *
 * This is ONE global template (shared via cloud settings, like academicUnits)
 * applied the same way inside every Academic unit: each unit is split into
 * Sections (A, B, ...), and each Section is split into Lessons (1, 2, ...).
 * Sections and Lessons are treated as independent scopes: entries may belong
 * to a specific lessonId, or to no section/lesson at all (older/general words
 * for the unit, shown outside any section — never hidden).
 *
 * Shape:
 * {
 *   sections: [
 *     {
 *       id: "A",                 // stable letter id, never reused
 *       label: "Section A",      // fixed base label
 *       customName: "",          // optional admin-given nickname shown next to the label
 *       lessons: [
 *         { id: "A-1", number: 1, label: "Lesson 1", customName: "" },
 *         { id: "A-2", number: 2, label: "Lesson 2", customName: "" },
 *       ],
 *     },
 *     ...
 *   ]
 * }
 */
const STRUCTURE_CACHE_KEY = "twoTongues.unitStructure";

const SECTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function sectionLabel(id) {
  return `Section ${id}`;
}
function lessonLabel(n) {
  return `Lesson ${n}`;
}

/** Default template shipped with the app: Section A / Section B, 2 lessons each.
 * Lesson numbers are continuous across the whole unit (Section A = 1,2 →
 * Section B = 3,4 → ...), matching how teachers number lessons in the book. */
export function defaultUnitStructure() {
  return {
    sections: [
      {
        id: "A",
        label: sectionLabel("A"),
        customName: "",
        lessons: [
          { id: "A-1", number: 1, label: lessonLabel(1), customName: "" },
          { id: "A-2", number: 2, label: lessonLabel(2), customName: "" },
        ],
      },
      {
        id: "B",
        label: sectionLabel("B"),
        customName: "",
        lessons: [
          { id: "B-1", number: 3, label: lessonLabel(3), customName: "" },
          { id: "B-2", number: 4, label: lessonLabel(4), customName: "" },
        ],
      },
    ],
  };
}

/** Highest lesson number used anywhere in the structure (0 if none). */
function maxLessonNumber(structure) {
  let max = 0;
  for (const s of structure.sections || []) {
    for (const l of s.lessons || []) {
      if (typeof l.number === "number" && l.number > max) max = l.number;
    }
  }
  return max;
}

function normalizeLesson(sectionId, raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const number =
    typeof raw.number === "number" && Number.isFinite(raw.number)
      ? raw.number
      : index + 1;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `${sectionId}-${number}`;
  const customName = typeof raw.customName === "string" ? raw.customName.trim() : "";
  return {
    id,
    number,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : lessonLabel(number),
    customName,
  };
}

function normalizeSection(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : SECTION_LETTERS[index] || `S${index + 1}`;
  const customName = typeof raw.customName === "string" ? raw.customName.trim() : "";
  const lessonsRaw = Array.isArray(raw.lessons) ? raw.lessons : [];
  const lessons = lessonsRaw
    .map((l, i) => normalizeLesson(id, l, i))
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
  return {
    id,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : sectionLabel(id),
    customName,
    lessons: lessons.length ? lessons : [normalizeLesson(id, { number: 1 }, 0)],
  };
}

export function normalizeUnitStructure(raw) {
  const sectionsRaw = raw && Array.isArray(raw.sections) ? raw.sections : null;
  if (!sectionsRaw || !sectionsRaw.length) return defaultUnitStructure();
  const seen = new Set();
  const sections = [];
  sectionsRaw.forEach((s, i) => {
    const normalized = normalizeSection(s, i);
    if (!normalized || seen.has(normalized.id)) return;
    seen.add(normalized.id);
    sections.push(normalized);
  });
  if (!sections.length) return defaultUnitStructure();
  return { sections };
}

export function loadUnitStructureCache() {
  try {
    const raw = localStorage.getItem(STRUCTURE_CACHE_KEY);
    if (!raw) return defaultUnitStructure();
    return normalizeUnitStructure(JSON.parse(raw));
  } catch (_) {
    return defaultUnitStructure();
  }
}

export function saveUnitStructureCache(structure) {
  try {
    localStorage.setItem(
      STRUCTURE_CACHE_KEY,
      JSON.stringify(normalizeUnitStructure(structure))
    );
  } catch (_) {}
}

/** Find a section by id. */
export function findSection(structure, sectionId) {
  if (!sectionId) return null;
  return (structure?.sections || []).find((s) => s.id === sectionId) || null;
}

/** Find a lesson by (sectionId, lessonId) — lessonId already encodes its section. */
export function findLesson(structure, lessonId) {
  if (!lessonId) return null;
  for (const s of structure?.sections || []) {
    const lesson = s.lessons.find((l) => l.id === lessonId);
    if (lesson) return { ...lesson, sectionId: s.id };
  }
  return null;
}

/** Display name for a section: custom nickname (if set) alongside the base label. */
export function sectionDisplayName(section) {
  if (!section) return "";
  return section.customName ? `${section.label} · ${section.customName}` : section.label;
}

/** Display name for a lesson: custom nickname (if set) alongside the base label. */
export function lessonDisplayName(lesson) {
  if (!lesson) return "";
  return lesson.customName ? `${lesson.label} · ${lesson.customName}` : lesson.label;
}

function nextSectionId(structure) {
  const used = new Set((structure.sections || []).map((s) => s.id));
  return SECTION_LETTERS.find((l) => !used.has(l)) || `S${structure.sections.length + 1}`;
}

export function addSection(structure, customName = "") {
  const norm = normalizeUnitStructure(structure);
  const id = nextSectionId(norm);
  const nextNumber = maxLessonNumber(norm) + 1;
  const section = {
    id,
    label: sectionLabel(id),
    customName: String(customName || "").trim(),
    lessons: [{ id: `${id}-${nextNumber}`, number: nextNumber, label: lessonLabel(nextNumber), customName: "" }],
  };
  return normalizeUnitStructure({ sections: [...norm.sections, section] });
}

export function renameSection(structure, sectionId, customName) {
  const norm = normalizeUnitStructure(structure);
  return normalizeUnitStructure({
    sections: norm.sections.map((s) =>
      s.id === sectionId ? { ...s, customName: String(customName || "").trim() } : s
    ),
  });
}

export function deleteSection(structure, sectionId) {
  const norm = normalizeUnitStructure(structure);
  const next = norm.sections.filter((s) => s.id !== sectionId);
  return next.length ? normalizeUnitStructure({ sections: next }) : defaultUnitStructure();
}

export function addLesson(structure, sectionId, customName = "") {
  const norm = normalizeUnitStructure(structure);
  const number = maxLessonNumber(norm) + 1;
  return normalizeUnitStructure({
    sections: norm.sections.map((s) => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        lessons: [
          ...s.lessons,
          { id: `${sectionId}-${number}`, number, label: lessonLabel(number), customName: String(customName || "").trim() },
        ],
      };
    }),
  });
}

export function renameLesson(structure, lessonId, customName) {
  const norm = normalizeUnitStructure(structure);
  return normalizeUnitStructure({
    sections: norm.sections.map((s) => ({
      ...s,
      lessons: s.lessons.map((l) =>
        l.id === lessonId ? { ...l, customName: String(customName || "").trim() } : l
      ),
    })),
  });
}

export function deleteLesson(structure, sectionId, lessonId) {
  const norm = normalizeUnitStructure(structure);
  return normalizeUnitStructure({
    sections: norm.sections.map((s) => {
      if (s.id !== sectionId) return s;
      const next = s.lessons.filter((l) => l.id !== lessonId);
      return { ...s, lessons: next.length ? next : s.lessons };
    }),
  });
}
