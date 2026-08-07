import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../lib/config/i18n";
import { XIcon, ClockIcon } from "../common/Icons";
import NumberStepper from "../common/NumberStepper";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import { addTimerMinutes } from "../../lib/state/goals";
import {
  TIMER_PREFS_KEY, TIMER_STATE_KEY, CHANNEL_NAME,
  FONTS, BG_PRESETS, DEFAULT_PREFS, ALARM_SOUNDS, AMBIENT_SOUNDS,
  loadPrefs, savePrefs, loadLiveState, saveLiveState, clearLiveState,
  pad, formatMs, parseHms, isMobileLike, getAudioCtx, tone, playAlarmSound, createAmbientNode,
} from "../../lib/utils/timerUtils";

export default function TimerPage({ onClose, isAr, onBubbleChange, initialBubble = false }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(25);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showSettings, setShowSettings] = useState(true);
  const [doneFlash, setDoneFlash] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // "full" = full-page timer UI; "bubble" = in-app floating mini timer
  // (used on phones instead of a broken about:blank tab from window.open).
  const [viewMode, setViewMode] = useState(initialBubble ? "bubble" : "full");
  const [bubblePos, setBubblePos] = useState({ x: null, y: null }); // null = default bottom-end
  const dragRef = useRef(null);

  useBodyScrollLock(viewMode === "full");

  const endAtRef = useRef(null); // absolute timestamp when countdown ends
  const startedAtRef = useRef(null); // for stopwatch
  const accumulatedRef = useRef(0); // pause-accumulated elapsed for stopwatch
  const rafRef = useRef(null);
  const channelRef = useRef(null);
  const pipWinRef = useRef(null);
  const fileInputRef = useRef(null);
  const controlsRef = useRef({ start: () => {}, pause: () => {}, reset: () => {}, openMini: () => {} });
  const runningRef = useRef(false);
  const ambientRef = useRef(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const fontCss = useMemo(() => (FONTS.find((f) => f.id === prefs.fontId) || FONTS[0]).css, [prefs.fontId]);
  const bgCss = useMemo(() => {
    if (prefs.customBg) return `center / cover no-repeat url(${prefs.customBg})`;
    const preset = BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0];
    return preset.value;
  }, [prefs.customBg, prefs.bgId]);

  const isLightBg = useMemo(() => {
    if (prefs.customBg) return false;
    return prefs.bgId === "paper";
  }, [prefs.customBg, prefs.bgId]);

  const displayText = prefs.mode === "stopwatch" ? formatMs(elapsedMs) : formatMs(remainingMs);

  // Persist prefs
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  // BroadcastChannel for popup / PiP sync — always routes through refs so
  // controls stay fresh without re-subscribing the channel every render.
  useEffect(() => {
    let ch = null;
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = ch;
      ch.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.type !== "control") return;
        if (msg.action === "pause") controlsRef.current.pause();
        if (msg.action === "resume") controlsRef.current.start();
        if (msg.action === "reset") controlsRef.current.reset();
      };
    } catch {}
    return () => {
      try { ch && ch.close(); } catch {}
      channelRef.current = null;
    };
  }, []);

  const broadcastState = useCallback((extra = {}) => {
    const payload = {
      type: "state",
      mode: prefs.mode,
      running,
      remainingMs,
      elapsedMs,
      display: prefs.mode === "stopwatch" ? formatMs(elapsedMs) : formatMs(remainingMs),
      prefs: {
        fontId: prefs.fontId,
        fontSize: Math.min(prefs.fontSize, 64),
        textColor: prefs.textColor,
        bgId: prefs.bgId,
        customBg: null, // don't ship large data URLs over the channel
      },
      ...extra,
    };
    try {
      channelRef.current?.postMessage(payload);
    } catch {}
    saveLiveState({
      mode: prefs.mode,
      running,
      remainingMs,
      elapsedMs,
      endAt: endAtRef.current,
      startedAt: startedAtRef.current,
      accumulated: accumulatedRef.current,
      updatedAt: Date.now(),
    });
  }, [prefs, running, remainingMs, elapsedMs]);

  // Tick loop
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      if (prefs.mode === "countdown") {
        const left = Math.max(0, (endAtRef.current || 0) - Date.now());
        setRemainingMs(left);
        if (left <= 0) {
          runningRef.current = false;
          setRunning(false);
          setDoneFlash(true);
          playAlarmSound(prefsRef.current.alarmId, prefsRef.current.alarmVolume);
          try { ambientRef.current && ambientRef.current.stop(); } catch {}
          ambientRef.current = null;
          try {
            const ms = sessionDurationRef.current || 0;
            if (ms > 0) addTimerMinutes(Math.max(1, Math.round(ms / 60000)));
            sessionDurationRef.current = 0;
          } catch (_) {}
          endAtRef.current = null;
          setTimeout(() => setDoneFlash(false), 2500);
          broadcastState({ running: false, remainingMs: 0, display: "00:00" });
          return;
        }
      } else {
        const elapsed = accumulatedRef.current + (Date.now() - (startedAtRef.current || Date.now()));
        setElapsedMs(elapsed);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, prefs.mode, broadcastState]);

  // Push state to popup periodically while running
  useEffect(() => {
    broadcastState();
  }, [running, remainingMs, elapsedMs, broadcastState]);

  // Restore mid-run state if user reopened the page
  useEffect(() => {
    const live = loadLiveState();
    if (!live) return;
    if (live.mode) setPrefs((p) => ({ ...p, mode: live.mode }));
    if (live.mode === "countdown" && live.endAt && live.running) {
      const left = live.endAt - Date.now();
      if (left > 0) {
        endAtRef.current = live.endAt;
        setRemainingMs(left);
        setRunning(true);
        setShowSettings(false);
      } else {
        clearLiveState();
      }
    } else if (live.mode === "stopwatch" && live.running) {
      accumulatedRef.current = live.accumulated || 0;
      startedAtRef.current = live.startedAt || Date.now();
      setElapsedMs(accumulatedRef.current + (Date.now() - startedAtRef.current));
      setRunning(true);
      setShowSettings(false);
    } else if (typeof live.remainingMs === "number") {
      setRemainingMs(live.remainingMs);
      const totalSec = Math.floor(live.remainingMs / 1000);
      setHours(Math.floor(totalSec / 3600));
      setMins(Math.floor((totalSec % 3600) / 60));
      setSecs(totalSec % 60);
    }
  }, []);

  useEffect(() => () => { try { ambientRef.current && ambientRef.current.stop(); } catch {} }, []);

  // Keep parent in sync after refresh restore (bubble vs full page).
  useEffect(() => {
    try { onBubbleChange && onBubbleChange(viewMode === "bubble"); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On desktop only: try a real floating window when the tab is hidden.
  // On phones, window.open becomes a full blank tab (see screenshot) — so we
  // never auto-open there; the in-app bubble is the mobile path instead.
  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "hidden") return;
      if (!runningRef.current) return;
      // Minimize to bubble so timer UI remains when user comes back.
      controlsRef.current.goBubble && controlsRef.current.goBubble();
      if (!isMobileLike()) {
        // Desktop: try always-on-top PiP over other windows.
        const fn = controlsRef.current.openDesktopPip;
        if (fn) fn().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Keep the screen awake while the timer is running (helps on phones).
  useEffect(() => {
    let lock = null;
    async function request() {
      try {
        if (!running) return;
        if (!("wakeLock" in navigator)) return;
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => {});
      } catch {}
    }
    request();
    function onVis() {
      if (document.visibilityState === "visible" && runningRef.current) request();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try { lock && lock.release(); } catch {}
    };
  }, [running]);


  function stopAmbient() {
    try { ambientRef.current && ambientRef.current.stop(); } catch {}
    ambientRef.current = null;
  }

  function startAmbient() {
    stopAmbient();
    const id = prefsRef.current.ambientId;
    if (!id || id === "off") return;
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      ambientRef.current = createAmbientNode(ctx, id, prefsRef.current.ambientVolume);
    } catch {}
  }

  const sessionDurationRef = useRef(0); // ms credited when countdown completes

  function start() {
    setErrorMsg("");
    setDoneFlash(false);
    if (prefs.mode === "countdown") {
      const total = remainingMs > 0 ? remainingMs : parseHms(hours, mins, secs);
      if (total <= 0) {
        setErrorMsg(tr(isAr, "Set a duration first.", "حدد مدة أولاً."));
        return;
      }
      setRemainingMs(total);
      endAtRef.current = Date.now() + total;
      sessionDurationRef.current = total;
    } else {
      startedAtRef.current = Date.now();
      sessionDurationRef.current = 0;
    }
    runningRef.current = true;
    setRunning(true);
    setShowSettings(false);
    startAmbient();
  }

  function pause() {
    if (prefs.mode === "countdown") {
      const left = Math.max(0, (endAtRef.current || Date.now()) - Date.now());
      setRemainingMs(left);
      endAtRef.current = null;
    } else {
      accumulatedRef.current = elapsedMs;
      startedAtRef.current = null;
    }
    runningRef.current = false;
    setRunning(false);
    stopAmbient();
  }

  function reset() {
    runningRef.current = false;
    setRunning(false);
    endAtRef.current = null;
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    const total = parseHms(hours, mins, secs);
    setRemainingMs(prefs.mode === "countdown" ? (total || 25 * 60 * 1000) : 0);
    setDoneFlash(false);
    clearLiveState();
    setShowSettings(true);
    stopAmbient();
  }

  function applyDuration() {
    const total = parseHms(hours, mins, secs);
    setRemainingMs(total);
    if (running && prefs.mode === "countdown") {
      endAtRef.current = Date.now() + total;
    }
  }

  function updatePref(patch) {
    setPrefs((p) => ({ ...p, ...patch }));
  }

  function onBgFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg(tr(isAr, "Please choose an image file.", "اختر ملف صورة من فضلك."));
      return;
    }
    // Cap ~2.5MB to keep localStorage happy
    if (file.size > 2.5 * 1024 * 1024) {
      setErrorMsg(tr(isAr, "Image is too large (max ~2.5 MB).", "الصورة كبيرة جدًا (الحد ~٢٫٥ ميجا)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updatePref({ customBg: reader.result, bgId: "custom" });
      setErrorMsg("");
    };
    reader.onerror = () => setErrorMsg(tr(isAr, "Couldn't read the image.", "تعذّر قراءة الصورة."));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function clearCustomBg() {
    updatePref({ customBg: null, bgId: "ink" });
  }

  function buildMiniHtml() {
    const color = prefs.textColor || "#fff";
    const font = fontCss;
    const bg = prefs.customBg
      ? `#111`
      : ((BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0]).value);
    return `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${tr(isAr, "Timer", "مؤقّت")}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;width:100%;overflow:hidden;font-family:${font};margin:0}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100%;min-height:100dvh;width:100%;
    background:${bg};color:${color};user-select:none;-webkit-user-select:none;
    text-align:center;padding:16px;box-sizing:border-box}
  #t{font-size:clamp(40px,16vw,80px);font-weight:700;letter-spacing:0.02em;
    font-variant-numeric:tabular-nums;text-shadow:0 2px 24px rgba(0,0,0,0.35);
    line-height:1.1;width:100%}
  #row{display:flex;gap:8px;margin-top:16px}
  button{border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;
    cursor:pointer;background:rgba(255,255,255,0.18);color:inherit;backdrop-filter:blur(6px)}
  button:hover{background:rgba(255,255,255,0.28)}
  #label{font-size:11px;opacity:0.7;margin-top:10px;letter-spacing:0.06em;text-transform:uppercase}
</style>
</head>
<body>
  <div id="t">${displayText}</div>
  <div id="row">
    <button id="toggle">${running ? tr(isAr, "Pause", "إيقاف") : tr(isAr, "Resume", "متابعة")}</button>
    <button id="reset">${tr(isAr, "Reset", "إعادة")}</button>
  </div>
  <div id="label">${tr(isAr, "Bacaloria Community · Timer", "Bacaloria Community · مؤقّت")}</div>
<script>
  const ch = new BroadcastChannel("${CHANNEL_NAME}");
  const t = document.getElementById("t");
  const toggle = document.getElementById("toggle");
  let isRunning = ${running ? "true" : "false"};
  ch.onmessage = (ev) => {
    const m = ev.data;
    if (!m || m.type !== "state") return;
    if (m.display) t.textContent = m.display;
    isRunning = !!m.running;
    toggle.textContent = isRunning ? ${JSON.stringify(tr(isAr, "Pause", "إيقاف"))} : ${JSON.stringify(tr(isAr, "Resume", "متابعة"))};
  };
  toggle.onclick = () => {
    ch.postMessage({ type: "control", action: isRunning ? "pause" : "resume" });
  };
  document.getElementById("reset").onclick = () => {
    ch.postMessage({ type: "control", action: "reset" });
  };
</script>
</body>
</html>`;
  }

  function goBubble() {
    setViewMode("bubble");
    setPipOpen(true);
    setErrorMsg("");
    try { onBubbleChange && onBubbleChange(true); } catch {}
  }

  function expandFromBubble() {
    setViewMode("full");
    setPipOpen(false);
    try { onBubbleChange && onBubbleChange(false); } catch {}
  }

  function handleClose() {
    // X while running -> minimize to bubble (dictionary comes back underneath).
    // X while stopped -> leave timer entirely and return to dictionary.
    if (runningRef.current || running) {
      goBubble();
      // On desktop also try a real always-on-top PiP window.
      if (!isMobileLike()) {
        openDesktopPip().catch(() => {});
      }
      return;
    }
    try { onBubbleChange && onBubbleChange(false); } catch {}
    onClose();
  }

  async function openDesktopPip() {
    if (typeof window === "undefined") return false;
    if (!window.documentPictureInPicture) return false;
    if (window.documentPictureInPicture.window) return true; // already open
    try {
      const pip = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 200,
      });
      pipWinRef.current = pip;
      setPipOpen(true);
      const doc = pip.document;
      doc.head.innerHTML = "";
      doc.body.innerHTML = "";
      const style = doc.createElement("style");
      const bg = prefs.customBg ? "#111" : ((BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0]).value);
      style.textContent = `
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow:hidden;font-family:${fontCss}}
        body{display:flex;flex-direction:column;align-items:center;justify-content:center;
          min-height:100%;background:${bg};color:${prefs.textColor};user-select:none}
        #t{font-size:clamp(28px,14vw,64px);font-weight:700;font-variant-numeric:tabular-nums;
          text-shadow:0 2px 20px rgba(0,0,0,0.35)}
        #row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center}
        button{border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;
          cursor:pointer;background:rgba(255,255,255,0.18);color:inherit}
      `;
      doc.head.appendChild(style);
      const tEl = doc.createElement("div");
      tEl.id = "t";
      tEl.textContent = displayText;
      doc.body.appendChild(tEl);
      const row = doc.createElement("div");
      row.id = "row";
      const pauseBtn = doc.createElement("button");
      pauseBtn.textContent = runningRef.current ? tr(isAr, "Pause", "إيقاف") : tr(isAr, "Resume", "متابعة");
      pauseBtn.onclick = () => {
        channelRef.current?.postMessage({ type: "control", action: runningRef.current ? "pause" : "resume" });
      };
      const resetBtn = doc.createElement("button");
      resetBtn.textContent = tr(isAr, "Reset", "إعادة");
      resetBtn.onclick = () => channelRef.current?.postMessage({ type: "control", action: "reset" });
      row.appendChild(pauseBtn);
      row.appendChild(resetBtn);
      doc.body.appendChild(row);

      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (ev) => {
        const m = ev.data;
        if (!m || m.type !== "state") return;
        if (m.display) tEl.textContent = m.display;
        pauseBtn.textContent = m.running
          ? tr(isAr, "Pause", "إيقاف")
          : tr(isAr, "Resume", "متابعة");
      };
      pip.addEventListener("pagehide", () => {
        try { ch.close(); } catch {}
        pipWinRef.current = null;
        setPipOpen(false);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function openMiniWindow() {
    // Always keep the in-app bubble so the timer stays over the dictionary.
    goBubble();

    // Phones cannot float a web UI over other apps — OS / browser limitation.
    if (isMobileLike()) {
      setErrorMsg(tr(
        isAr,
        "On phones the bubble stays inside this app. Websites cannot float over other apps or outside the browser.",
        "على الموبايل الفقاعة تفضل جوه التطبيق. المواقع متقدرش تطفو فوق تطبيقات تانية أو بره المتصفح — قيد من النظام."
      ));
      return;
    }

    // Desktop: always-on-top Document Picture-in-Picture when supported (Chrome).
    const ok = await openDesktopPip();
    if (ok) return;

    // Last resort: small popup (may be blocked).
    try {
      const w = window.open(
        "",
        "twoTonguesTimer",
        "width=360,height=240,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
      );
      if (!w) return;
      pipWinRef.current = w;
      setPipOpen(true);
      w.document.open();
      w.document.write(buildMiniHtml());
      w.document.close();
      w.addEventListener("beforeunload", () => {
        pipWinRef.current = null;
        setPipOpen(false);
      });
    } catch {}
  }

  // Keep control refs current for BroadcastChannel + visibility handlers.
  controlsRef.current = { start, pause, reset, openMini: openMiniWindow, goBubble, openDesktopPip };
  runningRef.current = running;

  const panelBg = isLightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)";
  const panelBorder = isLightBg ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.16)";
  const muted = isLightBg ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  const btnPrimary = {
    padding: "12px 22px",
    borderRadius: 12,
    border: "none",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    background: "linear-gradient(135deg, var(--accent-1, #19A7CE), var(--accent-2, #146C94))",
    color: "#fff",
    boxShadow: "0 10px 24px -12px rgba(0,0,0,0.45)",
  };
  const btnGhost = {
    padding: "10px 16px",
    borderRadius: 12,
    border: `1px solid ${panelBorder}`,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    background: panelBg,
    color: prefs.textColor,
  };
  const field = {
    width: 64,
    padding: "10px 8px",
    borderRadius: 10,
    border: `1px solid ${panelBorder}`,
    background: panelBg,
    color: prefs.textColor,
    fontSize: 18,
    fontWeight: 700,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  };

  // ---------- In-app floating bubble (mobile-safe mini timer) ----------
  if (viewMode === "bubble") {
    const bubbleBg = prefs.customBg
      ? "#1a1a1a"
      : ((BG_PRESETS.find((b) => b.id === prefs.bgId) || BG_PRESETS[0]).value);
    const left = bubblePos.x != null ? bubblePos.x : undefined;
    const top = bubblePos.y != null ? bubblePos.y : undefined;
    const useDefaultCorner = bubblePos.x == null;

    const onPointerDown = (e) => {
      // Only drag from the shell, not from buttons
      if (e.target.closest("button")) return;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      dragRef.current = {
        ox: e.clientX - rect.left,
        oy: e.clientY - rect.top,
        w: rect.width,
        h: rect.height,
      };
      el.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragRef.current) return;
      const { ox, oy, w, h } = dragRef.current;
      const x = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX - ox));
      const y = Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY - oy));
      setBubblePos({ x, y });
    };
    const onPointerUp = () => { dragRef.current = null; };

    const bubble = (
      <div
        role="dialog"
        aria-label={tr(isAr, "Mini timer", "مؤقّت مصغّر")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "fixed",
          zIndex: 3000,
          ...(useDefaultCorner
            ? { bottom: "max(16px, env(safe-area-inset-bottom))", insetInlineEnd: 16 }
            : { left, top }),
          minWidth: 168,
          maxWidth: "min(240px, calc(100vw - 24px))",
          padding: "14px 16px 12px",
          borderRadius: 18,
          background: bubbleBg,
          color: prefs.textColor,
          boxShadow: "0 16px 40px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.12)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          touchAction: "none",
          userSelect: "none",
          cursor: "grab",
          fontFamily: fontCss,
        }}
      >
        <div
          style={{
            fontSize: "clamp(28px, 8vw, 36px)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
            lineHeight: 1,
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
          }}
        >
          {displayText}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => (running ? pause() : start())}
            style={{
              border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", background: "rgba(255,255,255,0.2)", color: "inherit",
            }}
          >
            {running ? tr(isAr, "Pause", "إيقاف") : tr(isAr, "Resume", "متابعة")}
          </button>
          <button
            type="button"
            onClick={expandFromBubble}
            style={{
              border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", background: "rgba(255,255,255,0.2)", color: "inherit",
            }}
          >
            {tr(isAr, "Expand", "تكبير")}
          </button>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            style={{
              border: "none", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 700,
              cursor: "pointer", background: "rgba(255,255,255,0.12)", color: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label={tr(isAr, "Close", "إغلاق")}
          >
            <XIcon size={12} />
          </button>
        </div>
      </div>
    );

    return typeof document !== "undefined" ? createPortal(bubble, document.body) : bubble;
  }


  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        display: "flex",
        flexDirection: "column",
        background: bgCss,
        color: prefs.textColor,
        overflow: "auto",
        transition: "background 0.35s ease",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          gap: 8,
          background: isLightBg ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)",
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${panelBorder}`,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ display: "flex", color: prefs.textColor, opacity: 0.9, flexShrink: 0 }}>
            <ClockIcon size={20} />
          </span>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {tr(isAr, "Study Timer", "مؤقّت المذاكرة")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => setShowSettings((s) => !s)} style={{ ...btnGhost, padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }}>
            {showSettings ? tr(isAr, "Hide", "إخفاء") : tr(isAr, "Settings", "إعدادات")}
          </button>
          <button
            type="button"
            onClick={openMiniWindow}
            style={{ ...btnGhost, padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }}
            title={tr(isAr, "Open mini floating timer", "فتح مؤقّت عائم صغير")}
          >
            {tr(isAr, "Mini", "مصغّر")}
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label={tr(isAr, "Close", "إغلاق")}
            style={{
              ...btnGhost,
              width: 40,
              height: 40,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
            }}
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>

      {/* Main display */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px 40px",
          gap: 28,
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontFamily: fontCss,
            fontSize: `clamp(42px, ${Math.max(8, prefs.fontSize * 0.12)}vw, ${prefs.fontSize}px)`,
            fontWeight: 700,
            letterSpacing: "0.03em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            textShadow: isLightBg ? "none" : "0 4px 40px rgba(0,0,0,0.35)",
            animation: doneFlash ? "timerPulse 0.6s ease 3" : undefined,
            transition: "font-size 0.2s ease, color 0.2s ease",
          }}
        >
          {displayText}
        </div>

        {doneFlash && (
          <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.95 }}>
            {tr(isAr, "Time's up!", "انتهى الوقت!")}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {!running ? (
            <button type="button" onClick={start} style={btnPrimary}>
              {tr(isAr, "Start", "ابدأ")}
            </button>
          ) : (
            <button type="button" onClick={pause} style={btnPrimary}>
              {tr(isAr, "Pause", "إيقاف مؤقت")}
            </button>
          )}
          <button type="button" onClick={reset} style={btnGhost}>
            {tr(isAr, "Reset", "إعادة تعيين")}
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              maxWidth: 420,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(220,38,38,0.18)",
              border: "1px solid rgba(220,38,38,0.45)",
              color: isLightBg ? "#991b1b" : "#fecaca",
              fontSize: 13,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {errorMsg}
          </div>
        )}

        {pipOpen && (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {tr(isAr, "Mini timer window is open.", "نافذة المؤقّت الصغيرة مفتوحة.")}
          </div>
        )}
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          style={{
            flexShrink: 0,
            maxHeight: "48vh",
            overflowY: "auto",
            padding: "18px 20px 28px",
            background: isLightBg ? "rgba(251,247,239,0.97)" : "rgba(12,16,22,0.97)",
            backdropFilter: "blur(14px)",
            borderTop: `1px solid ${panelBorder}`,
          }}
        >
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {/* Mode */}
            <section>
              <Label muted={muted}>{tr(isAr, "Mode", "الوضع")}</Label>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { id: "countdown", en: "Countdown", ar: "عدّ تنازلي" },
                  { id: "stopwatch", en: "Stopwatch", ar: "ساعة توقيت" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      updatePref({ mode: m.id });
                      setRunning(false);
                      endAtRef.current = null;
                      startedAtRef.current = null;
                      accumulatedRef.current = 0;
                      setElapsedMs(0);
                      if (m.id === "countdown") {
                        const total = parseHms(hours, mins, secs) || 25 * 60 * 1000;
                        setRemainingMs(total);
                      } else {
                        setRemainingMs(0);
                      }
                    }}
                    style={{
                      ...btnGhost,
                      background: prefs.mode === m.id ? "rgba(255,255,255,0.28)" : panelBg,
                      outline: prefs.mode === m.id ? `2px solid ${prefs.textColor}` : "none",
                      outlineOffset: 1,
                    }}
                  >
                    {tr(isAr, m.en, m.ar)}
                  </button>
                ))}
              </div>
            </section>

            {/* Duration — free, no hard cap beyond practical UI limits */}
            {prefs.mode === "countdown" && (
              <section>
                <Label muted={muted}>{tr(isAr, "Duration (no limit — set any time)", "المدة (بدون قيد — اختر أي وقت)")}</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <NumberStepper
                      min={0} max={999} value={hours} width={100}
                      onChange={(v) => setHours(v)}
                      aria-label={tr(isAr, "Hours", "ساعات")}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{tr(isAr, "Hours", "ساعات")}</span>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.5 }}>:</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <NumberStepper
                      min={0} max={59} value={mins} width={100}
                      onChange={(v) => setMins(v)}
                      aria-label={tr(isAr, "Minutes", "دقائق")}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{tr(isAr, "Minutes", "دقائق")}</span>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 700, opacity: 0.5 }}>:</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <NumberStepper
                      min={0} max={59} value={secs} width={100}
                      onChange={(v) => setSecs(v)}
                      aria-label={tr(isAr, "Seconds", "ثوانٍ")}
                    />
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{tr(isAr, "Seconds", "ثوانٍ")}</span>
                  </div>
                  <button type="button" onClick={applyDuration} style={{ ...btnGhost, marginInlineStart: 8 }}>
                    {tr(isAr, "Apply", "تطبيق")}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {[
                    { label: "5m", h: 0, m: 5, s: 0 },
                    { label: "15m", h: 0, m: 15, s: 0 },
                    { label: "25m", h: 0, m: 25, s: 0 },
                    { label: "45m", h: 0, m: 45, s: 0 },
                    { label: "1h", h: 1, m: 0, s: 0 },
                    { label: "2h", h: 2, m: 0, s: 0 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setHours(p.h);
                        setMins(p.m);
                        setSecs(p.s);
                        setRemainingMs(parseHms(p.h, p.m, p.s));
                      }}
                      style={{ ...btnGhost, padding: "6px 12px", fontSize: 12 }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Font */}
            <section>
              <Label muted={muted}>{tr(isAr, "Font", "الخط")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => updatePref({ fontId: f.id })}
                    style={{
                      ...btnGhost,
                      fontFamily: f.css,
                      outline: prefs.fontId === f.id ? `2px solid ${prefs.textColor}` : "none",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Size + color */}
            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <Label muted={muted}>{tr(isAr, "Size", "الحجم")} — {prefs.fontSize}px</Label>
                <input
                  type="range"
                  min={36}
                  max={180}
                  value={prefs.fontSize}
                  onChange={(e) => updatePref({ fontSize: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: prefs.textColor }}
                />
              </div>
              <div>
                <Label muted={muted}>{tr(isAr, "Text color", "لون النص")}</Label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="color"
                    value={prefs.textColor}
                    onChange={(e) => updatePref({ textColor: e.target.value })}
                    style={{ width: 48, height: 36, border: "none", background: "none", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", opacity: 0.8 }}>
                    {prefs.textColor}
                  </span>
                </div>
              </div>
            </section>

            {/* Backgrounds */}
            <section>
              <Label muted={muted}>{tr(isAr, "Background", "الخلفية")}</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8 }}>
                {BG_PRESETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => updatePref({ bgId: b.id, customBg: null })}
                    title={tr(isAr, b.label.en, b.label.ar)}
                    style={{
                      height: 56,
                      borderRadius: 12,
                      border: prefs.bgId === b.id && !prefs.customBg ? `2px solid ${prefs.textColor}` : `1px solid ${panelBorder}`,
                      background: b.value,
                      cursor: "pointer",
                      boxShadow: "0 4px 12px -6px rgba(0,0,0,0.35)",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
                <button type="button" onClick={() => fileInputRef.current?.click()} style={btnGhost}>
                  {tr(isAr, "Upload from device", "رفع من الجهاز")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={onBgFile}
                />
                {prefs.customBg && (
                  <button type="button" onClick={clearCustomBg} style={btnGhost}>
                    {tr(isAr, "Remove custom image", "إزالة الصورة المخصصة")}
                  </button>
                )}
              </div>
              {prefs.customBg && (
                <div
                  style={{
                    marginTop: 10,
                    height: 72,
                    borderRadius: 12,
                    background: `center / cover no-repeat url(${prefs.customBg})`,
                    border: `2px solid ${prefs.textColor}`,
                  }}
                />
              )}
            </section>

            {/* Alarm + ambient sounds */}
            <section>
              <Label muted={muted}>{tr(isAr, "Alarm sound (when time is up)", "صوت المنبّه (عند انتهاء الوقت)")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ALARM_SOUNDS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      updatePref({ alarmId: s.id });
                      if (s.id !== "off") playAlarmSound(s.id, prefs.alarmVolume);
                    }}
                    style={{
                      ...btnGhost,
                      padding: "8px 12px",
                      fontSize: 13,
                      outline: prefs.alarmId === s.id ? `2px solid ${prefs.textColor}` : "none",
                    }}
                  >
                    {tr(isAr, s.en, s.ar)}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, opacity: 0.75, minWidth: 72 }}>{tr(isAr, "Volume", "مستوى الصوت")}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.alarmVolume}
                  onChange={(e) => updatePref({ alarmVolume: Number(e.target.value) })}
                  style={{ flex: 1, accentColor: prefs.textColor }}
                />
              </div>
            </section>

            <section>
              <Label muted={muted}>{tr(isAr, "Background sound (while running)", "صوت الخلفية (أثناء التشغيل)")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AMBIENT_SOUNDS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      updatePref({ ambientId: s.id });
                      // Live preview: restart ambient if timer is running
                      if (runningRef.current) {
                        stopAmbient();
                        if (s.id !== "off") {
                          try {
                            const ctx = getAudioCtx();
                            if (ctx) ambientRef.current = createAmbientNode(ctx, s.id, prefs.ambientVolume);
                          } catch {}
                        }
                      } else if (s.id !== "off") {
                        // short preview
                        try {
                          const ctx = getAudioCtx();
                          if (!ctx) return;
                          const node = createAmbientNode(ctx, s.id, prefs.ambientVolume);
                          setTimeout(() => { try { node && node.stop(); } catch {} }, 1800);
                        } catch {}
                      }
                    }}
                    style={{
                      ...btnGhost,
                      padding: "8px 12px",
                      fontSize: 13,
                      outline: prefs.ambientId === s.id ? `2px solid ${prefs.textColor}` : "none",
                    }}
                  >
                    {tr(isAr, s.en, s.ar)}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, opacity: 0.75, minWidth: 72 }}>{tr(isAr, "Volume", "مستوى الصوت")}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={prefs.ambientVolume}
                  onChange={(e) => {
                    const vol = Number(e.target.value);
                    updatePref({ ambientVolume: vol });
                    try { ambientRef.current && ambientRef.current.setVolume(vol); } catch {}
                  }}
                  style={{ flex: 1, accentColor: prefs.textColor }}
                />
              </div>
            </section>

            <p style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5, margin: 0 }}>
              {tr(
                isAr,
                "Tip: X while the timer is running minimizes to a bubble over the dictionary (does not stop it). On desktop, Chrome can also open an always-on-top window. Phones cannot show a website over other apps — that is an OS limit.",
                "نصيحة: زر X أثناء التشغيل يصغّر لفقاعة فوق الديكشنري (من غير ما يوقف المؤقّت). على الكمبيوتر Chrome يقدر يفتح نافذة فوق التطبيقات. الموبايل لا يسمح لموقع يظهر فوق تطبيقات تانية — قيد من النظام."
              )}
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes timerPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

function Label({ children, muted }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: muted,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}
