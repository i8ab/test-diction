// Simple UI feedback sounds via Web Audio API (no external files).
// Safe to call from anywhere; respects localStorage preference.

let _ctx = null;

function getCtx() {
  try {
    if (!_ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    }
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch (_) {
    return null;
  }
}

function tone(freq, duration, type, gainValue) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (_) {}
}

export function isUiSoundEnabled() {
  try {
    return localStorage.getItem("twoTongues.uiSounds") === "1";
  } catch (_) {
    return false;
  }
}

/** kind: "correct" | "wrong" | "tap" | "achieve" */
export function playUiSound(kind) {
  if (!isUiSoundEnabled()) return;
  if (kind === "correct") {
    tone(523.25, 0.08, "sine", 0.08);
    setTimeout(() => tone(659.25, 0.12, "sine", 0.07), 70);
  } else if (kind === "wrong") {
    tone(200, 0.15, "triangle", 0.06);
  } else if (kind === "tap") {
    tone(800, 0.03, "sine", 0.04);
  } else if (kind === "achieve") {
    tone(523.25, 0.08, "sine", 0.07);
    setTimeout(() => tone(659.25, 0.08, "sine", 0.07), 80);
    setTimeout(() => tone(783.99, 0.14, "sine", 0.08), 160);
  }
}

