// Simple UI feedback sounds via Web Audio API (no external files).
// Safe to call from anywhere; respects localStorage preference.

let _ctx = null;

function getCtx() {
  try {
    if (typeof window === "undefined") return null;
    if (!_ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ctx = new AC();
    }
    if (_ctx.state === "suspended") {
      // Must be resumed from a user gesture; quiz taps qualify.
      _ctx.resume().catch(() => {});
    }
    return _ctx;
  } catch (_) {
    return null;
  }
}

/**
 * Play a short tone. Uses linear ramps (more reliable than exponential,
 * which can throw / stay silent when the start value is ~0).
 */
function tone(freq, duration, type, gainValue) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const vol = Math.max(0.0001, gainValue || 0.08);

    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, now);

    // Attack → sustain → release (linear = reliable across browsers)
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.012);
    gain.gain.linearRampToValueAtTime(vol * 0.85, now + Math.max(0.02, duration * 0.55));
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
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

  // Ensure context is running (especially on Safari / mobile)
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  if (kind === "correct") {
    // Bright ascending pair
    tone(523.25, 0.1, "sine", 0.11);
    setTimeout(() => tone(659.25, 0.14, "sine", 0.1), 75);
  } else if (kind === "wrong") {
    // Clear descending pair — was nearly inaudible as a single soft triangle beep
    tone(280, 0.12, "square", 0.09);
    setTimeout(() => tone(180, 0.16, "square", 0.08), 90);
  } else if (kind === "tap") {
    tone(800, 0.04, "sine", 0.05);
  } else if (kind === "achieve") {
    tone(523.25, 0.09, "sine", 0.09);
    setTimeout(() => tone(659.25, 0.09, "sine", 0.09), 80);
    setTimeout(() => tone(783.99, 0.16, "sine", 0.1), 160);
  }
}
