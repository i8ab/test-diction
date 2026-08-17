/**
 * مسارات البكالوريا — الصف الثاني والثالث
 * specialty: اختيار الطالب في الصف الثاني فقط
 */

export const BAC_GRADES = [
  { id: "2", ar: "الصف الثاني الثانوي", en: "Grade 11 (2nd secondary)" },
  { id: "3", ar: "الصف الثالث الثانوي", en: "Grade 12 (3rd secondary)" },
];

export const BAC_TRACKS = [
  {
    id: "medicine",
    ar: "الطب وعلوم الحياة",
    en: "Medicine & Life Sciences",
    grade2Specialties: [
      { id: "physics", ar: "الفيزياء", en: "Physics" },
      { id: "math", ar: "الرياضيات", en: "Mathematics" },
    ],
    grade3Subjects: [
      { id: "biology", ar: "الأحياء (متقدم)", en: "Biology (advanced)" },
      { id: "chemistry", ar: "الكيمياء (متقدم)", en: "Chemistry (advanced)" },
    ],
  },
  {
    id: "engineering",
    ar: "الهندسة وعلوم الحاسب",
    en: "Engineering & Computer Science",
    grade2Specialties: [
      { id: "chemistry", ar: "الكيمياء", en: "Chemistry" },
      { id: "programming_ai", ar: "البرمجة والذكاء الاصطناعي", en: "Programming & AI" },
    ],
    grade3Subjects: [
      { id: "math", ar: "الرياضيات (متقدم)", en: "Mathematics (advanced)" },
      { id: "physics", ar: "الفيزياء (متقدم)", en: "Physics (advanced)" },
    ],
  },
  {
    id: "business",
    ar: "الأعمال",
    en: "Business",
    grade2Specialties: [
      { id: "accounting", ar: "المحاسبة", en: "Accounting" },
      { id: "management", ar: "إدارة الأعمال", en: "Business Administration" },
    ],
    grade3Subjects: [
      { id: "economics", ar: "الاقتصاد (متقدم)", en: "Economics (advanced)" },
      { id: "math", ar: "الرياضيات", en: "Mathematics" },
    ],
  },
  {
    id: "arts",
    ar: "الآداب والفنون",
    en: "Arts & Literature",
    grade2Specialties: [
      { id: "psychology", ar: "علم النفس", en: "Psychology" },
      { id: "second_lang", ar: "اللغة الأجنبية الثانية", en: "Second foreign language" },
    ],
    grade3Subjects: [
      { id: "geography", ar: "الجغرافيا (متقدم)", en: "Geography (advanced)" },
      { id: "statistics", ar: "الإحصاء", en: "Statistics" },
    ],
  },
];

export function getBacTrack(trackId) {
  return BAC_TRACKS.find((t) => t.id === trackId) || null;
}

export function getBacGrade(gradeId) {
  return BAC_GRADES.find((g) => g.id === gradeId) || null;
}

export function getSpecialtyOptions(trackId) {
  const t = getBacTrack(trackId);
  return t ? t.grade2Specialties : [];
}

export function getSpecialtyLabel(trackId, specialtyId, isAr) {
  const opts = getSpecialtyOptions(trackId);
  const s = opts.find((o) => o.id === specialtyId);
  if (!s) return specialtyId || "—";
  return isAr ? s.ar : s.en;
}

export function formatBacSummary(account, isAr) {
  if (!account) return "";
  const track = getBacTrack(account.bacTrack);
  const grade = getBacGrade(account.bacGrade);
  if (!track && !grade) return "";
  const parts = [];
  if (track) parts.push(isAr ? track.ar : track.en);
  if (grade) parts.push(isAr ? grade.ar : grade.en);
  if (account.bacGrade === "2" && account.bacSpecialty) {
    parts.push(getSpecialtyLabel(account.bacTrack, account.bacSpecialty, isAr));
  }
  return parts.join(" · ");
}
