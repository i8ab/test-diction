/**
 * Pure mappers / normalizers for /api/jsonbin (no I/O).
 * Phase D extract from api/jsonbin.js
 */

export function pickBanner(raw) {
  if (!raw || typeof raw !== "object") return null;
  const b = raw;
  let shine = typeof b.shine === "number" ? b.shine : 40;
  if (shine < 0) shine = 0;
  if (shine > 100) shine = 100;
  let speed = typeof b.speed === "number" ? b.speed : 1;
  if (speed < 0.4) speed = 0.4;
  if (speed > 2) speed = 2;
  let letterSpacing =
    typeof b.letterSpacing === "number"
      ? b.letterSpacing
      : typeof b.letter_spacing === "number"
        ? b.letter_spacing
        : 0;
  if (letterSpacing < 0) letterSpacing = 0;
  if (letterSpacing > 30) letterSpacing = 30;
  let repeats = typeof b.repeats === "number" ? b.repeats : 4;
  if (repeats < 1) repeats = 1;
  if (repeats > 12) repeats = 12;
  repeats = Math.round(repeats);
  let durationMinutes =
    typeof b.durationMinutes === "number"
      ? b.durationMinutes
      : typeof b.duration_minutes === "number"
        ? b.duration_minutes
        : 0;
  if (!durationMinutes && typeof b.durationHours === "number" && b.durationHours > 0) {
    durationMinutes = Math.round(b.durationHours * 60);
  }
  if (durationMinutes < 0) durationMinutes = 0;
  if (durationMinutes > 60 * 24 * 30) durationMinutes = 60 * 24 * 30;
  const updatedAt =
    typeof b.updatedAt === "number"
      ? b.updatedAt
      : typeof b.updated_at === "number"
        ? b.updated_at
        : 0;
  return {
    id: typeof b.id === "string" ? b.id : "",
    message: typeof b.message === "string" ? b.message : "",
    color: typeof b.color === "string" ? b.color : "#146C94",
    enabled: !!b.enabled,
    updatedAt,
    shine,
    speed,
    letterSpacing,
    flash: !!b.flash,
    repeats,
    durationMinutes,
  };
}

export function normalizeExamTime(t) {
  if (typeof t !== "string" || !/^\d{1,2}:\d{2}$/.test(t)) return "09:00";
  const [hh, mm] = t.split(":");
  return `${String(Number(hh)).padStart(2, "0")}:${mm}`;
}

export function pickExamItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const date =
    typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
      ? raw.date
      : null;
  if (!date) return null;
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const color =
    typeof raw.color === "string" && raw.color.trim()
      ? raw.color.trim()
      : "#e85d04";
  return {
    id,
    date,
    time: normalizeExamTime(raw.time),
    color,
    labelEn: typeof raw.labelEn === "string" ? raw.labelEn : "",
    labelAr: typeof raw.labelAr === "string" ? raw.labelAr : "",
  };
}

/**
 * Supports both legacy single-exam shape { enabled, date, time, ... }
 * and the queue shape { enabled, exams: [...] }.
 * Always persists the full exams array so every client sees the next exam
 * when the current one passes (not only the device that saved it).
 */

export function pickExamConfig(raw) {
  if (!raw || typeof raw !== "object") return null;

  let exams = [];
  if (Array.isArray(raw.exams) && raw.exams.length > 0) {
    const seen = new Set();
    for (const it of raw.exams) {
      const item = pickExamItem(it);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      exams.push(item);
    }
  } else if (
    typeof raw.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
  ) {
    // migrate legacy single exam → queue of one
    const item = pickExamItem(raw);
    if (item) exams = [item];
  }

  // sort by date+time ascending
  exams.sort((a, b) => {
    const ta = examItemTs(a);
    const tb = examItemTs(b);
    return ta - tb;
  });

  const enabled = raw.enabled === true && exams.length > 0;
  // mirror of the first/active item for older readers
  const active = exams[0] || null;

  return {
    enabled,
    exams,
    date: active ? active.date : null,
    time: active ? active.time : "09:00",
    color: active ? active.color : "#e85d04",
    labelEn: active ? active.labelEn : "",
    labelAr: active ? active.labelAr : "",
  };
}

export function examItemTs(item) {
  if (!item || !item.date) return Infinity;
  const [y, m, d] = item.date.split("-").map(Number);
  const time = normalizeExamTime(item.time);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? Infinity : dt.getTime();
}

export function pickAcademicUnits(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const out = [];
  for (const u of raw) {
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
  out.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return out.length ? out : null;
}

export function logFromRow(row) {
  return {
    id: row.id,
    action: row.action || "",
    message: row.message || "",
    actorName: row.actor_name || row.actorName || "",
    actorCode: row.actor_code || row.actorCode || "",
    at: typeof row.at === "number" ? row.at : Number(row.at) || 0,
  };
}

export function logToRow(log) {
  return {
    id: log.id,
    action: log.action || "",
    message: log.message || "",
    actor_name: log.actorName || log.actor_name || "",
    actor_code: log.actorCode || log.actor_code || "",
    at: typeof log.at === "number" ? log.at : Date.now(),
  };
}

/** Keep only logs from the last 24 hours. */

export function pruneLogsLast24h(logs) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return (logs || []).filter((l) => (l.at || 0) >= cutoff);
}

/**
 * Strip heavy fields for dictionary list payloads (bandwidth).
 * Full object still available via scope=entry&id=… or fields=full (default).
 */

export function toLightEntry(e) {
  if (!e || typeof e !== "object") return e;
  const example =
    typeof e.example === "string"
      ? e.example.length > 120
        ? e.example.slice(0, 120)
        : e.example
      : e.example || "";
  const definition =
    typeof e.definition === "string"
      ? e.definition.length > 200
        ? e.definition.slice(0, 200)
        : e.definition
      : e.definition || "";
  const out = {
    id: e.id,
    word: e.word,
    meaning: e.meaning,
    definition,
    example,
    section: e.section,
    pos: e.pos,
    type: e.type,
    addedAt: e.addedAt,
  };
  // "Light" only trims oversized single strings above — it must never drop
  // the *structure* of a multi-meaning word. Without `senses`, any device
  // that loads this trimmed payload (every device except the one that just
  // added/edited the word locally) only ever sees the first meaning/type.
  if (Array.isArray(e.senses) && e.senses.length) out.senses = e.senses;
  if (Array.isArray(e.examples) && e.examples.length) out.examples = e.examples;
  if (e.notes) out.notes = e.notes;
  if (Array.isArray(e.synonyms) && e.synonyms.length) out.synonyms = e.synonyms;
  if (Array.isArray(e.antonyms) && e.antonyms.length) out.antonyms = e.antonyms;
  if (e.unitId != null) out.unitId = e.unitId;
  return out;
}

export function mapEntriesLight(entries) {
  return (entries || []).map(toLightEntry);
}

/**
 * Admin list payload — drop secrets and bulky progress maps.
 * Full object: fields=full or scope=account&code=.
 */

export function toLightAccount(a) {
  if (!a || typeof a !== "object") return a;
  // Profile + bac + social link fields must survive refresh.
  // Omit undefined so later {...prev, ...light} merges do not wipe DB values.
  // Still omit secrets: passwordHash, bulky progress maps, etc.
  const out = {
    code: a.code,
    username: a.username,
    name: a.name,
    status: a.status,
    role: a.role,
  };
  const optional = [
    "isAdmin",
    "gender",
    "birthDate",
    "path",
    "bacTrack",
    "bacGrade",
    "bacSpecialty",
    "avatar",
    "authProvider",
    "socialId",
    "email",
    "createdAt",
    "updatedAt",
    "sessionId",
    "banned",
    "blockedAt",
  ];
  for (const k of optional) {
    if (a[k] !== undefined && a[k] !== null && a[k] !== "") {
      out[k] = a[k];
    }
  }
  // Allow explicit empty gender if set
  if (a.gender === "") out.gender = "";
  return out;
}

export function mapAccountsLight(accounts) {
  return (accounts || []).map(toLightAccount);
}

export function entryIdOf(e) {
  if (!e || e.id == null || e.id === "") return "";
  return String(e.id);
}

/**
 * Load all entry ids currently stored in DB (from jsonb data.id).
 * Returns { ids: Set<string>, count: number }.
 */

export function resolveEntriesForSave(incomingEntries, currentEntries, { confirmWipe = false } = {}) {
  const incoming = Array.isArray(incomingEntries) ? incomingEntries : null;
  const current = Array.isArray(currentEntries) ? currentEntries : [];

  // Client omitted entries → keep whatever is already on the server.
  if (incoming === null) return current;

  if (incoming.length === 0 && current.length > 0 && !confirmWipe) {
    const err = new Error(
      "Refusing to wipe the dictionary: client sent 0 words but the server still has entries. " +
        "Pass confirmWipeEntries:true only for an intentional full clear."
    );
    err.code = "EMPTY_ENTRIES_WIPE_BLOCKED";
    err.serverCount = current.length;
    throw err;
  }
  return incoming;
}

/** Extract stable word id from an entry object. */

