// Arabic is a closed pronoun set too, so a direct lookup is the correct
// (non-random) way to detect a pronoun — same idea as the English list.
export const PRONOUNS_AR = new Set([
  "أنا", "نحن", "أنتَ", "أنتِ", "أنتما", "أنتم", "أنتن",
  "هو", "هي", "هما", "هم", "هن",
  "إياي", "إيانا", "إياك", "إياكِ", "إياكما", "إياكم", "إياكن",
  "إياه", "إياها", "إياهما", "إياهم", "إياهن",
  "هذا", "هذه", "هذان", "هاتان", "هؤلاء", "ذلك", "تلك", "ذانك", "تانك", "أولئك",
  "الذي", "التي", "اللذان", "اللتان", "الذين", "اللاتي", "اللواتي", "اللائي",
  "من", "ما", "أي",
]);

// Common Arabic adjective (اسم الصفة) patterns/awzān — checked with regex
// against the bare word. Not exhaustive, but these cover the large majority
// of adjectives learners run into.
export const ADJECTIVE_PATTERNS_AR = [
  // ياء النسبة المؤنثة، وهي الأوضح: عربية، جامعية، مصرية...
  { test: (w) => /ية$/.test(w) && w.length >= 4, label: "نسبة (ياء النسب)" },
  // وزن أَفْعَل: أحمر، أطول، أجمل... (يستثني كلمات شائعة تبدأ بأ لأسباب أخرى)
  { test: (w) => /^أ.{3}$/.test(w) && !/^أ(ن|ست|ص|نت)/.test(w), label: "وزن أَفْعَل (تفضيل/لون/عيب)" },
  // وزن فَعيل: جميل، كبير، طويل، جديد... (كلمة من 4 أحرف، ثالثها ياء)
  { test: (w) => w.length === 4 && w[2] === "ي", label: "وزن فَعيل" },
  // وزن فعّال للمبالغة عند وجود الشدة، مثل: كذّاب
  { test: (w) => /ّال$/.test(w), label: "وزن فعّال (مبالغة)" },
  // اسم مفعول: مكتوب، معقول... (يبدأ بميم وحرفه الرابع واو)
  { test: (w) => w.length === 5 && w[0] === "م" && w[3] === "و", label: "اسم مفعول (وزن مَفعول)" },
];

// Rough shape-based verb detection. Real Arabic morphology needs a full
// root-and-pattern analyzer; this heuristic checks the affixes/letters that
// mark tense on the *surface form* of the word, which is enough to tell
// "likely a verb" from "likely a noun" for common learner vocabulary.
export function looksLikeArabicVerb(word) {
  const w = word.trim();
  if (!w) return false;
  // الأمر: يبدأ بهمزة وصل + وزن قصير من فعل ثلاثي، مثل: اكتبْ، اذهبْ، العبْ
  if (/^ا.{2,3}$/.test(w)) return true;
  // المضارع: يبدأ بأحد أحرف المضارعة أ ن ي ت
  if (/^[أنيت].{2,}/.test(w) && w.length >= 3) return true;
  // الماضي: ينتهي بضمائر متصلة تدل على الفاعل
  if (/(تُ|تَ|تِ|نا|تما|تم|تن|ت|وا|ن)$/.test(w) && w.length >= 3) return true;
  return false;
}
