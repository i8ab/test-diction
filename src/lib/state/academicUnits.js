/**
 * Academic section units — shared via cloud settings (like examConfig).
 * Local cache keeps the last-known list available offline.
 */
import { uid } from "../utils/quizHelpers";

const UNITS_CACHE_KEY = "twoTongues.academicUnits";
const ACTIVE_UNIT_KEY = "twoTongues.activeAcademicUnitId";

/** Default units shipped with the app (admin can rename / add / delete). */
export function defaultAcademicUnits() {
  return [
    { id: "unit-1", name: "Unit 1", order: 1 },
    { id: "unit-2", name: "Unit 2", order: 2 },
    { id: "unit-3", name: "Unit 3", order: 3 },
    { id: "unit-4", name: "Unit 4", order: 4 },
    { id: "unit-5", name: "Unit 5", order: 5 },
  ];
}

export function normalizeAcademicUnits(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return defaultAcademicUnits();
  const seen = new Set();
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const u = raw[i];
    if (!u || typeof u !== "object") continue;
    const id = typeof u.id === "string" && u.id.trim() ? u.id.trim() : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name =
      typeof u.name === "string" && u.name.trim()
        ? u.name.trim()
        : `Unit ${out.length + 1}`;
    const order =
      typeof u.order === "number" && Number.isFinite(u.order)
        ? u.order
        : out.length + 1;
    out.push({ id, name, order });
  }
  if (!out.length) return defaultAcademicUnits();
  out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return out;
}

export function loadAcademicUnitsCache() {
  try {
    const raw = localStorage.getItem(UNITS_CACHE_KEY);
    if (!raw) return defaultAcademicUnits();
    return normalizeAcademicUnits(JSON.parse(raw));
  } catch (_) {
    return defaultAcademicUnits();
  }
}

export function saveAcademicUnitsCache(units) {
  try {
    localStorage.setItem(
      UNITS_CACHE_KEY,
      JSON.stringify(normalizeAcademicUnits(units))
    );
  } catch (_) {}
}

export function loadActiveAcademicUnitId(units) {
  try {
    const id = localStorage.getItem(ACTIVE_UNIT_KEY);
    if (id && units.some((u) => u.id === id)) return id;
  } catch (_) {}
  return units[0]?.id || null;
}

export function saveActiveAcademicUnitId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_UNIT_KEY, id);
    else localStorage.removeItem(ACTIVE_UNIT_KEY);
  } catch (_) {}
}

export function createAcademicUnit(units, name) {
  const list = normalizeAcademicUnits(units);
  const maxOrder = list.reduce((m, u) => Math.max(m, u.order || 0), 0);
  const nextName =
    (name && String(name).trim()) || `Unit ${list.length + 1}`;
  const unit = {
    id: `unit-${uid().slice(0, 8)}`,
    name: nextName,
    order: maxOrder + 1,
  };
  return normalizeAcademicUnits([...list, unit]);
}

export function renameAcademicUnit(units, unitId, name) {
  const nextName = String(name || "").trim();
  if (!nextName) return normalizeAcademicUnits(units);
  return normalizeAcademicUnits(
    units.map((u) => (u.id === unitId ? { ...u, name: nextName } : u))
  );
}

export function deleteAcademicUnit(units, unitId) {
  return normalizeAcademicUnits(units.filter((u) => u.id !== unitId));
}
