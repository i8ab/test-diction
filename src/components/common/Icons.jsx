// All small inline SVG icon components used across the app, plus the
// SpeakButton (pronounce-word) control which is built on top of them.

import { tr } from "../../lib/config/i18n";
import { speakWord } from "../../lib/utils/speech";

function Icon({ path, size = 16, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {path}
    </svg>
  );
}
const SearchIcon = (p) => <Icon {...p} path={<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>} />;
const PlusIcon = (p) => <Icon {...p} path={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />;
const BookIcon = (p) => <Icon {...p} path={<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 0 4 5.5v14ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-3H6.5a2.5 2.5 0 0 0 0 5"/>} />;
const XIcon = (p) => <Icon {...p} path={<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>} />;
const TrashIcon = (p) => <Icon {...p} path={<><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>} />;
const LoaderIcon = (p) => <Icon {...p} path={<path d="M21 12a9 9 0 1 1-6.219-8.56"/>} className="spin" />;
const LoginIcon = (p) => <Icon {...p} path={<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></>} />;
const KeyIcon = (p) => <Icon {...p} path={<><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></>} />;
const CopyIcon = (p) => <Icon {...p} path={<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>} />;
const CheckIcon = (p) => <Icon {...p} path={<path d="M20 6 9 17l-5-5"/>} />;
const ChevronIcon = (p) => <Icon {...p} path={<path d="m9 18 6-6-6-6"/>} />;
const EditIcon = (p) => <Icon {...p} path={<><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></>} />;
const UsersIcon = (p) => <Icon {...p} path={<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>} />;
const EyeIcon = (p) => <Icon {...p} path={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>} />;
const EyeOffIcon = (p) => <Icon {...p} path={<><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></>} />;
const SunIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>} />;
const MoonIcon = (p) => <Icon {...p} path={<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/>} />;
const MenuIcon = (p) => <Icon {...p} path={<><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></>} />;
const WifiOffIcon = (p) => <Icon {...p} path={<><path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 3.5-2.3"/><path d="M19 12.5a10 10 0 0 0-2.5-1.9"/><path d="M12.5 8.5a13 13 0 0 1 6 1.6"/><path d="M2 8.5a13 13 0 0 1 3.5-2.4"/><line x1="12" y1="20" x2="12.01" y2="20"/></>} />;
const DownloadIcon = (p) => <Icon {...p} path={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>} />;
const UserIcon = (p) => <Icon {...p} path={<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>} />;
const LogoutIcon = (p) => <Icon {...p} path={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>} />;
const ZoomIcon = (p) => <Icon {...p} path={<><circle cx="11" cy="11" r="7"/><circle cx="11" cy="11" r="2.75"/><path d="m21 21-3.8-3.8"/></>} />;
const GlobeIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></>} />;
const QuizIcon = (p) => <Icon {...p} path={<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="m8 17 2 2 4-4"/></>} />;
const StatsIcon = (p) => <Icon {...p} path={<><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>} />;
const TrophyIcon = (p) => <Icon {...p} path={<><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a2 2 0 0 0 0 4h3"/><path d="M17 5h3a2 2 0 0 1 0 4h-3"/></>} />;
const FlameIcon = (p) => <Icon {...p} path={<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17a2.5 2.5 0 0 0 2.5-2.5c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7.5 7.5 0 1 1-15 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5"/>} />;
const ExternalLinkIcon = (p) => <Icon {...p} path={<><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></>} />;
const SpeakerIcon = (p) => <Icon {...p} path={<><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>} />;
const MoreIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/></>} />;
const StarIcon = (p) => <Icon {...p} path={<path d="m12 2 2.9 6.26 6.9.6-5.2 4.6 1.56 6.76L12 16.9l-6.16 3.32L7.4 13.46 2.2 8.86l6.9-.6Z"/>} />;
const UploadIcon = (p) => <Icon {...p} path={<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></>} />;
const UndoIcon = (p) => <Icon {...p} path={<><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-6.7L3 9"/></>} />;
const LinkIcon = (p) => <Icon {...p} path={<><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><path d="M8 12h8"/></>} />;
const ClockIcon = (p) => <Icon {...p} path={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>} />;
const MicIcon = (p) => <Icon {...p} path={<><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></>} />;
const BellIcon = (p) => <Icon {...p} path={<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>} />;
const BellOffIcon = (p) => <Icon {...p} path={<><path d="M8.7 3A6 6 0 0 1 18 8c0 2.1.4 3.7.9 5"/><path d="M17.7 17H3s3-2 3-9c0-.5 0-1 .1-1.5"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><line x1="2" y1="2" x2="22" y2="22"/></>} />;
const PaletteIcon = (p) => <Icon {...p} path={<><path d="M12 2a10 10 0 1 0 0 20 2.5 2.5 0 0 0 2-4 2 2 0 0 1 2-2h1a3 3 0 0 0 3-3c0-6-3.5-11-8-11Z"/><circle cx="7" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="10" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1.2" fill="currentColor" stroke="none"/></>} />;
const LayersIcon = (p) => <Icon {...p} path={<><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>} />;
const ShareIcon = (p) => <Icon {...p} path={<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></>} />;
const CalendarIcon = (p) => <Icon {...p} path={<><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></>} />;
const WandIcon = (p) => <Icon {...p} path={<><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></>} />;

function SpeakButton({ text, dir, isAr, size = 16, style }) {
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); speakWord(text, dir); }}
      title={tr(isAr, "Pronounce", "نطق الكلمة")}
      aria-label={tr(isAr, `Pronounce ${text}`, `نطق ${text}`)}
      style={{ border: "none", background: "none", color: "var(--icon-muted)", padding: 4, cursor: "pointer", display: "inline-flex", alignItems: "center", ...style }}>
      <SpeakerIcon size={size} />
    </button>
  );
}

export {
  Icon,
  SearchIcon,
  PlusIcon,
  BookIcon,
  XIcon,
  TrashIcon,
  LoaderIcon,
  LoginIcon,
  KeyIcon,
  CopyIcon,
  CheckIcon,
  ChevronIcon,
  EditIcon,
  UsersIcon,
  EyeIcon,
  EyeOffIcon,
  SunIcon,
  MoonIcon,
  MenuIcon,
  WandIcon,
  WifiOffIcon,
  DownloadIcon,
  UserIcon,
  LogoutIcon,
  ZoomIcon,
  GlobeIcon,
  QuizIcon,
  StatsIcon,
  TrophyIcon,
  FlameIcon,
  ExternalLinkIcon,
  SpeakerIcon,
  MoreIcon,
  StarIcon,
  UploadIcon,
  UndoIcon,
  LinkIcon,
  ClockIcon,
  MicIcon,
  BellIcon,
  BellOffIcon,
  PaletteIcon,
  LayersIcon,
  ShareIcon,
  CalendarIcon,
  SpeakButton,
};
