/**
 * بطاقة تعريفية للمطوّرين — للتجربة والعرض.
 * مطورين فقط: mickoly و aboawad
 */

export const DEVELOPERS = [
  {
    id: "mickoly",
    initials: "M",
    enName: "mickoly",
    arName: "mickoly",
    enRole: "Developer",
    arRole: "مطوّر",
    enTitle: "Full-stack · Product",
    arTitle: "فل ستاك · منتج",
    enFocus: "Study UX · SRS · Offline PWA",
    arFocus: "تجربة المذاكرة · SRS · أوفلاين",
    enBio: "Building a study app that feels premium, honest, and worth opening every day.",
    arBio: "ببني تطبيق مذاكرة شكله premium، أمين، ويستاهل يتفتح كل يوم.",
    project: "Bacaloria Community",
    skills: ["React", "Node", "PWA", "SRS", "i18n"],
    years: "3+",
    avatarTone: 1,
  },
  {
    id: "aboawad",
    initials: "A",
    enName: "aboawad",
    arName: "aboawad",
    enRole: "Developer",
    arRole: "مطوّر",
    enTitle: "Full-stack · Product",
    arTitle: "فل ستاك · منتج",
    enFocus: "Study UX · SRS · Offline PWA",
    arFocus: "تجربة المذاكرة · SRS · أوفلاين",
    enBio: "Building a study app that feels premium, honest, and worth opening every day.",
    arBio: "ببني تطبيق مذاكرة شكله premium، أمين، ويستاهل يتفتح كل يوم.",
    project: "Bacaloria Community",
    skills: ["React", "Node", "PWA", "SRS", "i18n"],
    years: "3+",
    avatarTone: 2,
  },
];

/**
 * بطاقة تعريف مطوّر واحدة.
 * @param {{ dev: typeof DEVELOPERS[0], isAr?: boolean, compact?: boolean }} props
 */
export default function DevIdCard({ dev, isAr = false, compact = false }) {
  if (!dev) return null;

  return (
    <article
      className={`dev-id-card${compact ? " is-compact" : ""}`}
      aria-label={dev.enName}
    >
      <style>{DEV_CARD_CSS}</style>

      <div className="dev-id-top">
        <div
          className={`dev-id-avatar${dev.avatarTone === 2 ? " is-tone-2" : ""}`}
          aria-hidden
        >
          <span>{dev.initials}</span>
        </div>
        <div className="dev-id-who">
          <div className="dev-id-role">{isAr ? dev.arRole : dev.enRole}</div>
          <h3 className="dev-id-name">{dev.enName}</h3>
        </div>
      </div>

      <div className="dev-id-divider" />

      <div className="dev-id-meta">
        <div className="dev-id-row">
          <span className="dev-id-k">{isAr ? "المشروع" : "Project"}</span>
          <span className="dev-id-v">{dev.project}</span>
        </div>
        <div className="dev-id-row">
          <span className="dev-id-k">{isAr ? "الدور" : "Role"}</span>
          <span className="dev-id-v">{isAr ? dev.arTitle : dev.enTitle}</span>
        </div>
        <div className="dev-id-row">
          <span className="dev-id-k">{isAr ? "التركيز" : "Focus"}</span>
          <span className="dev-id-v">{isAr ? dev.arFocus : dev.enFocus}</span>
        </div>
        {!compact && (
          <div className="dev-id-row">
            <span className="dev-id-k">{isAr ? "خبرة" : "Experience"}</span>
            <span className="dev-id-v">{dev.years} {isAr ? "سنة" : "yrs"}</span>
          </div>
        )}
      </div>

      {!compact && dev.skills?.length > 0 && (
        <div className="dev-id-skills">
          {dev.skills.map((s) => (
            <span key={s} className="dev-id-skill">
              {s}
            </span>
          ))}
        </div>
      )}

      <p className="dev-id-bio">{isAr ? dev.arBio : dev.enBio}</p>
    </article>
  );
}

const DEV_CARD_CSS = `
.dev-id-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  color: #f2f5fa;
  max-width: 420px;
}
.dev-id-card.is-compact { padding: 12px 14px; }
.dev-id-top {
  display: flex; align-items: center; gap: 14px;
}
.dev-id-avatar {
  flex-shrink: 0; width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 800; color: #fff; letter-spacing: 0.04em;
  background: linear-gradient(145deg, #5b8def, #7c3aed);
  box-shadow: 0 8px 20px -8px rgba(80,140,255,0.7);
}
.dev-id-avatar.is-tone-2 {
  background: linear-gradient(145deg, #7c3aed, #c026d3);
  box-shadow: 0 8px 20px -8px rgba(124,58,237,0.7);
}
.dev-id-card.is-compact .dev-id-avatar {
  width: 42px; height: 42px; font-size: 14px;
}
.dev-id-who { min-width: 0; }
.dev-id-role {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: #7eb6ff; margin-bottom: 3px;
}
.dev-id-name {
  margin: 0; font-size: 17px; font-weight: 800;
  letter-spacing: -0.02em; line-height: 1.25; color: #f2f5fa;
}
.dev-id-card.is-compact .dev-id-name { font-size: 15px; }
.dev-id-divider {
  height: 1px; margin: 14px 0 12px;
  background: rgba(255,255,255,0.08);
}
.dev-id-card.is-compact .dev-id-divider { margin: 10px 0 8px; }
.dev-id-meta {
  display: flex; flex-direction: column; gap: 8px;
}
.dev-id-row {
  display: flex; justify-content: space-between; align-items: baseline;
  gap: 12px; font-size: 12.5px;
}
.dev-id-k {
  color: rgba(255,255,255,0.4); font-weight: 600; flex-shrink: 0;
}
.dev-id-v {
  color: rgba(242,245,250,0.9); font-weight: 600; text-align: end;
}
.dev-id-skills {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 12px;
}
.dev-id-skill {
  font-size: 11px; font-weight: 700;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(90,140,255,0.15);
  color: #a8c8ff;
  border: 1px solid rgba(90,140,255,0.25);
}
.dev-id-bio {
  margin: 12px 0 0; font-size: 12.5px; line-height: 1.55;
  color: rgba(255,255,255,0.5); font-style: italic;
}
.dev-id-card.is-compact .dev-id-bio { margin-top: 8px; font-size: 12px; }
`;
