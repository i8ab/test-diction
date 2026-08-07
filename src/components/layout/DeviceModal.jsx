import { XIcon } from "../common/Icons";
import DevicePicker from "./DevicePicker";

export default function DeviceModal({ open, onClose, T, isAr, deviceMode, onChangeDeviceMode }) {
  if (!open || typeof onChangeDeviceMode !== "function") return null;
  return (
        <div onClick={onClose} className="modal-backdrop" style={{ position: "fixed", inset: 0, zIndex: 3600, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="device-modal-title" style={{ background: "var(--card)", borderRadius: 16, padding: 20, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px -20px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 id="device-modal-title" style={{ margin: 0, fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>{T("Device layout", "واجهة الجهاز")}</h2>
              <button type="button" onClick={onClose} aria-label={T("Close", "إغلاق")} style={{ border: "none", background: "var(--input-bg)", borderRadius: 10, width: 36, height: 36, cursor: "pointer", color: "var(--icon-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={18} /></button>
            </div>
            <DevicePicker
              mode={deviceMode}
              onSelect={(id) => { onChangeDeviceMode(id); onClose(); /* closed */; }}
              isAr={isAr}
              compact
            />
          </div>
        </div>
  );
}
