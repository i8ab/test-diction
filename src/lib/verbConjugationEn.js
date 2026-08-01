import { IRREGULAR_VERBS_EN } from "./englishLexicon.js";

// Standard spelling rules for regular verbs (used whenever the verb isn't
// in the irregular table). These are the textbook rules, applied in order.
function pastRegular(base) {
  if (/e$/.test(base)) return base + "d";
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + "ied";
  if (/^[a-z]*[^aeiouwxy][aeiou][^aeiouwxy]$/.test(base) && base.length <= 5) return base + base.slice(-1) + "ed";
  return base + "ed";
}

function gerund(base) {
  if (/ie$/.test(base)) return base.slice(0, -2) + "ying";
  if (/e$/.test(base) && !/ee$/.test(base)) return base.slice(0, -1) + "ing";
  if (/^[a-z]*[^aeiouwxy][aeiou][^aeiouwxy]$/.test(base) && base.length <= 5) return base + base.slice(-1) + "ing";
  return base + "ing";
}

function thirdPersonSingular(base) {
  if (/(s|x|z|ch|sh|o)$/.test(base)) return base + "es";
  if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + "ies";
  return base + "s";
}

// Builds the principal parts (base / 3rd person / past / past participle /
// gerund) for any English verb, irregular or regular.
export function getVerbForms(rawBase) {
  const base = rawBase.trim().toLowerCase();
  const irregular = IRREGULAR_VERBS_EN[base];
  const past = irregular ? irregular[0] : pastRegular(base);
  const pastParticiple = irregular ? irregular[1] : pastRegular(base);
  return {
    base,
    thirdPerson: thirdPersonSingular(base),
    gerund: gerund(base),
    past,
    pastParticiple,
    isIrregular: !!irregular,
  };
}

// The 12 standard English tenses, generated from the principal parts using
// their fixed auxiliary-verb formulas — deterministic, not guessed.
export function buildTwelveTenses(rawBase) {
  const f = getVerbForms(rawBase);
  const isBe = f.base === "be";
  const beHe = isBe ? "is" : `${f.thirdPerson}`;
  return {
    forms: f,
    tenses: [
      { group: "Present — المضارع", name: "Simple", nameAr: "المضارع البسيط", example: `He ${isBe ? "is" : f.thirdPerson}` },
      { group: "Present — المضارع", name: "Continuous", nameAr: "المضارع المستمر", example: `He is ${f.gerund}` },
      { group: "Present — المضارع", name: "Perfect", nameAr: "المضارع التام", example: `He has ${f.pastParticiple}` },
      { group: "Present — المضارع", name: "Perfect Continuous", nameAr: "المضارع التام المستمر", example: `He has been ${f.gerund}` },
      { group: "Past — الماضي", name: "Simple", nameAr: "الماضي البسيط", example: `He ${f.past}` },
      { group: "Past — الماضي", name: "Continuous", nameAr: "الماضي المستمر", example: `He was ${f.gerund}` },
      { group: "Past — الماضي", name: "Perfect", nameAr: "الماضي التام", example: `He had ${f.pastParticiple}` },
      { group: "Past — الماضي", name: "Perfect Continuous", nameAr: "الماضي التام المستمر", example: `He had been ${f.gerund}` },
      { group: "Future — المستقبل", name: "Simple", nameAr: "المستقبل البسيط", example: `He will ${f.base}` },
      { group: "Future — المستقبل", name: "Continuous", nameAr: "المستقبل المستمر", example: `He will be ${f.gerund}` },
      { group: "Future — المستقبل", name: "Perfect", nameAr: "المستقبل التام", example: `He will have ${f.pastParticiple}` },
      { group: "Future — المستقبل", name: "Perfect Continuous", nameAr: "المستقبل التام المستمر", example: `He will have been ${f.gerund}` },
    ],
  };
}
