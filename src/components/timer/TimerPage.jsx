import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import "./timer.css";
import { tr } from "../../lib/config/i18n";
import { XIcon, ClockIcon } from "../common/Icons";
import NumberStepper from "../common/NumberStepper";
import { useBodyScrollLock } from "../../lib/utils/useBodyScrollLock";
import {
  logTimerSession,
  getRecentTimerSessions,
  getLast24hTimerMinutes,
  getTodayTimerMinutes,
  pickPomoHealthTip,
} from "../../lib/state/goals";
import { loadXp, isThemeUnlocked, themeUnlockLevel } from "../../lib/state/xp";
import {
  CHANNEL_NAME,
  FONTS,
  BG_PRESETS,
  DEFAULT_PREFS,
  POMO_PRESETS,
  ALARM_SOUNDS,
  AMBIENT_SOUNDS,
  loadPrefs,
  savePrefs,
  loadLiveState,
  saveLiveState,
  clearLiveState,
  pad,
  formatMs,
  parseHms,
  isMobileLike,
} from "./timerConstants";
import { playAlarmSound, createAmbientNode, getAudioCtx } from "./timerAudio";
import { FlipClock } from "./FlipClock";
import { readPersistedTimer } from "./timerPersist";

export default function TimerPage({ onClose, isAr, accountCode, onBubbleChange, initialBubble = false }) {
  // One synchronous read for all initial state + refs (refresh-safe)
  const bootRef = useRef(null);
  if (bootRef.current == null) bootRef.current = readPersistedTimer();
  const boot = bootRef.current;

  const [prefs, setPrefs] = useState(() => {
    const p = loadPrefs();
    if (boot.mode && (boot.mode === "countdown" || boot.mode === "stopwatch" || boot.mode === "pomodoro")) {
      return { ...p, mode: boot.mode };
    }
    return p;
  });
  const xpTotal = useMemo(() => loadXp(accountCode).total, [accountCode]);
  const [hours, setHours] = useState(boot.hours);
  const [mins, setMins] = useState(boot.mins);
  const [secs, setSecs] = useState(boot.secs);
  const [running, setRunning] = useState(!!boot.running);
  const [remainingMs, setRemainingMs] = useState(boot.remainingMs);
  const [elapsedMs, setElapsedMs] = useState(boot.elapsedMs);
  const [showSettings, setShowSettings] = useState(false);
  const [doneFlash, setDoneFlash] = useState(false);
  // Pomodoro: phase work | break | idle-between (waiting for user to confirm next section)
  const [pomoPhase, setPomoPhase] = useState(boot.pomoPhase || "work"); // work | break
  const [pomoCycle, setPomoCycle] = useState(boot.pomoCycle || 1); // 1-based
  const [pomoAwaiting, setPomoAwaiting] = useState(null); // null | "break" | "work" | "done"
  const [pomoTip, setPomoTip] = useState(() => pickPomoHealthTip(boot.pomoPhase === "break" ? "break" : "work"));
  const [sessionLog, setSessionLog] = useState(() => getRecentTimerSessions());
  const [todayTotalMin, setTodayTotalMin] = useState(() => getTodayTimerMinutes());
  const [last24hMin, setLast24hMin] = useState(() => getLast24hTimerMinutes());
  const pomoPhaseRef = useRef(boot.pomoPhase || "work");
  const pomoCycleRef = useRef(boot.pomoCycle || 1);

  function refreshTimerLog() {
    setSessionLog(getRecentTimerSessions());
    setTodayTotalMin(getTodayTimerMinutes());
    setLast24hMin(getLast24hTimerMinutes());
  }
  const [pipOpen, setPipOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // "full" = full-page timer UI; "bubble" = in-app floating mini timer
  // (used on phones instead of a broken about:blank tab from window.open).
  const [viewMode, setViewMode] = useState(initialBubble ? "bubble" : "full");
  const [bubblePos, setBubblePos] = useState({ x: null, y: null }); // null = default bottom-end
  const dragRef = useRef(null);

  useBodyScrollLock(viewMode === "full");

  const endAtRef = useRef(boot.endAt || null); // absolute timestamp when countdown ends
  const startedAtRef = useRef(boot.startedAt || null); // for stopwatch
  const accumulatedRef = useRef(boot.accumulated || 0); // pause-accumulated elapsed for stopwatch
  const runningRef = useRef(!!boot.running);
  const rafRef = useRef(null);
  const channelRef = useRef(null);
  const pipWinRef = useRef(null);
  const fileInputRef = useRef(null);
  const controlsRef = useRef({ start: () => {}, pause: () => {}, reset: () => {}, openMini: () => {} });
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
  const isPomo = prefs.mode === "pomodoro";

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
      pomoPhase: pomoPhaseRef.current,
      pomoCycle: pomoCycleRef.current,
      updatedAt: Date.now(),
    });
  }, [prefs, running, remainingMs, elapsedMs]);

  // Tick loop
  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    let lastUiMs = -1;
    const tick = () => {
      if (prefs.mode === "countdown" || prefs.mode === "pomodoro") {
        const left = Math.max(0, (endAtRef.current || 0) - Date.now());
        // Update UI at most every 100ms — avoids localStorage/broadcast lag every frame
        if (lastUiMs < 0 || Math.abs(lastUiMs - left) >= 100 || left <= 0) {
          lastUiMs = left;
          setRemainingMs(left);
        }
        if (left <= 0) {
          runningRef.current = false;
          setRunning(false);
          setDoneFlash(true);
          playAlarmSound(prefsRef.current.alarmId, prefsRef.current.alarmVolume);
          try { ambientRef.current && ambientRef.current.stop(); } catch {}
          ambientRef.current = null;
          try {
            // Credit any remaining whole minutes from this run (partial sessions already flushed live)
            endCreditClock();
            sessionDurationRef.current = 0;
          } catch (_) {}
          endAtRef.current = null;
          setTimeout(() => setDoneFlash(false), 2500);
          broadcastState({ running: false, remainingMs: 0, display: "00:00" });

          // Pomodoro: never auto-start next section — wait for user confirm
          if (prefs.mode === "pomodoro") {
            const phase = pomoPhaseRef.current;
            const cycle = pomoCycleRef.current;
            const totalCycles = Math.max(1, prefsRef.current.pomoCycles || 4);
            if (phase === "work") {
              if (cycle >= totalCycles) {
                setPomoAwaiting("done");
              } else {
                setPomoTip(pickPomoHealthTip("break"));
                setPomoAwaiting("break");
              }
            } else {
              const next = cycle + 1;
              if (next > totalCycles) {
                setPomoAwaiting("done");
              } else {
                pomoCycleRef.current = next;
                setPomoCycle(next);
                setPomoTip(pickPomoHealthTip("work"));
                setPomoAwaiting("work");
              }
            }
          }
          return;
        }
      } else {
        const elapsed = accumulatedRef.current + (Date.now() - (startedAtRef.current || Date.now()));
        if (lastUiMs < 0 || Math.abs(lastUiMs - elapsed) >= 100) {
          lastUiMs = elapsed;
          setElapsedMs(elapsed);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, prefs.mode, broadcastState]);

  // Live credit: every 60s while running
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => flushTimerCredit(), 60000);
    return () => clearInterval(id);
  }, [running]);

  // Flush credit when leaving the page / tab; resume clock when coming back
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (runningRef.current) flushTimerCredit();
      } else if (document.visibilityState === "visible") {
        if (runningRef.current) beginCreditClock();
      }
    };
    const onPageHide = () => {
      if (runningRef.current) endCreditClock();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  // Push state to popup + localStorage — throttled to cut lag
  useEffect(() => {
    const t = setTimeout(() => broadcastState(), 80);
    return () => clearTimeout(t);
  }, [running, remainingMs, elapsedMs, broadcastState]);

  // Hard backup: write live state every second so refresh never loses time
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const isRunning = !!runningRef.current;
        const mode = prefsRef.current?.mode;
        const left =
          isRunning && endAtRef.current
            ? Math.max(0, endAtRef.current - Date.now())
            : null;
        const prev = loadLiveState() || {};
        saveLiveState({
          ...prev,
          mode: mode || prev.mode,
          running: isRunning,
          remainingMs: left != null ? left : prev.remainingMs,
          elapsedMs:
            mode === "stopwatch"
              ? (accumulatedRef.current || 0) +
                (startedAtRef.current ? Date.now() - startedAtRef.current : 0)
              : prev.elapsedMs,
          endAt: endAtRef.current || prev.endAt || null,
          startedAt: startedAtRef.current || prev.startedAt || null,
          accumulated: accumulatedRef.current ?? prev.accumulated,
          pomoPhase: pomoPhaseRef.current || prev.pomoPhase,
          pomoCycle: pomoCycleRef.current || prev.pomoCycle,
          updatedAt: Date.now(),
        });
      } catch (_) {}
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Boot already restored time/running from localStorage synchronously.
  // Here we only resume ambient audio + hide settings if we came back mid-run.
  useEffect(() => {
    if (boot.running) {
      setShowSettings(false);
      try {
        startAmbient();
      } catch (_) {}
      beginCreditClock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { try { ambientRef.current && ambientRef.current.stop(); } catch {} }, []);

  useEffect(() => {
    if (!showSettings) return;
    function onKey(e) {
      if (e.key === "Escape") setShowSettings(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showSettings]);

  // Keep parent in sync after refresh restore (bubble vs full page).
  useEffect(() => {
    try { onBubbleChange && onBubbleChange(viewMode === "bubble"); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On desktop only: try a real floating window when the tab is hidden.
  // On phones, window.open becomes a full blank tab — so we never auto-open
  // there; the in-app bubble is the mobile path instead.
  // IMPORTANT: skip minimize when the page is unloading (refresh / close),
  // otherwise refresh flips the timer into bubble mode and it looks like
  // the user was sent back to the home dictionary view.
  useEffect(() => {
    let unloading = false;
    function markUnload() {
      unloading = true;
      // Flush live timer state synchronously so refresh restores the correct time
      try {
        const isRunning = !!runningRef.current;
        const left =
          isRunning && endAtRef.current
            ? Math.max(0, endAtRef.current - Date.now())
            : undefined;
        const prev = loadLiveState() || {};
        saveLiveState({
          ...prev,
          mode: prefsRef.current?.mode || prev.mode,
          running: isRunning,
          remainingMs: left != null ? left : prev.remainingMs,
          endAt: endAtRef.current || prev.endAt || null,
          startedAt: startedAtRef.current || prev.startedAt || null,
          accumulated: accumulatedRef.current ?? prev.accumulated,
          pomoPhase: pomoPhaseRef.current || prev.pomoPhase,
          pomoCycle: pomoCycleRef.current || prev.pomoCycle,
          updatedAt: Date.now(),
        });
      } catch (_) {}
    }
    function onVis() {
      if (document.visibilityState !== "hidden") return;
      if (unloading) return;
      if (!runningRef.current) return;
      // Minimize to bubble so timer UI remains when user comes back.
      controlsRef.current.goBubble && controlsRef.current.goBubble();
      if (!isMobileLike()) {
        const fn = controlsRef.current.openDesktopPip;
        if (fn) fn().catch(() => {});
      }
    }
    window.addEventListener("pagehide", markUnload);
    window.addEventListener("beforeunload", markUnload);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", markUnload);
      window.removeEventListener("beforeunload", markUnload);
      document.removeEventListener("visibilitychange", onVis);
    };
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

  const sessionDurationRef = useRef(0); // planned length of current segment
  /** Full duration this segment started from — Reset restores this without killing the bubble. */
  const baseDurationRef = useRef(0);
  /**
   * Live session credit: record study minutes while the timer runs (not only on complete).
   * lastCreditAtRef = wall-clock when we last credited / started / resumed.
   */
  const lastCreditAtRef = useRef(null);

  function flushTimerCredit() {
    try {
      if (!lastCreditAtRef.current) return;
      const now = Date.now();
      const delta = Math.max(0, now - lastCreditAtRef.current);
      const mins = Math.floor(delta / 60000);
      if (mins <= 0) return;
      lastCreditAtRef.current = lastCreditAtRef.current + mins * 60000;
      const mode = prefsRef.current?.mode || prefs.mode;
      const phase = pomoPhaseRef.current || null;
      const cycle = pomoCycleRef.current || null;
      logTimerSession({
        minutes: mins,
        mode: mode === "pomodoro" ? "pomodoro" : mode === "stopwatch" ? "stopwatch" : "countdown",
        phase: mode === "pomodoro" ? phase : null,
        cycle: mode === "pomodoro" ? cycle : null,
      });
      refreshTimerLog();
    } catch (_) {}
  }

  function beginCreditClock() {
    lastCreditAtRef.current = Date.now();
  }

  function endCreditClock() {
    flushTimerCredit();
    lastCreditAtRef.current = null;
  }

  function pomoWorkMs() {
    return Math.max(1, Number(prefs.pomoWorkMin) || 25) * 60 * 1000;
  }
  function pomoBreakMs() {
    return Math.max(1, Number(prefs.pomoBreakMin) || 5) * 60 * 1000;
  }

  function start() {
    setErrorMsg("");
    setDoneFlash(false);
    setPomoAwaiting(null);
    if (prefs.mode === "countdown") {
      const total = remainingMs > 0 ? remainingMs : parseHms(hours, mins, secs);
      if (total <= 0) {
        setErrorMsg(tr(isAr, "Set a duration first.", "حدد مدة أولاً."));
        return;
      }
      // Remember the starting duration so Reset can restore it
      if (!baseDurationRef.current || total > baseDurationRef.current) {
        baseDurationRef.current = total;
      }
      setRemainingMs(total);
      endAtRef.current = Date.now() + total;
      sessionDurationRef.current = total;
    } else if (prefs.mode === "pomodoro") {
      const phase = pomoPhaseRef.current || "work";
      setPomoTip(pickPomoHealthTip(phase === "break" ? "break" : "work"));
      const full = phase === "break" ? pomoBreakMs() : pomoWorkMs();
      const total = remainingMs > 0 ? remainingMs : full;
      if (!baseDurationRef.current || phase === "work") {
        baseDurationRef.current = full;
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
    beginCreditClock();
    // Persist immediately so a refresh mid-second keeps the correct endAt
    try {
      saveLiveState({
        mode: prefs.mode,
        running: true,
        remainingMs: prefs.mode === "stopwatch" ? undefined : (remainingMs > 0 ? remainingMs : (prefs.mode === "pomodoro" ? (pomoPhaseRef.current === "break" ? pomoBreakMs() : pomoWorkMs()) : remainingMs)),
        elapsedMs: prefs.mode === "stopwatch" ? elapsedMs : undefined,
        endAt: endAtRef.current,
        startedAt: startedAtRef.current,
        accumulated: accumulatedRef.current,
        pomoPhase: pomoPhaseRef.current,
        pomoCycle: pomoCycleRef.current,
        updatedAt: Date.now(),
      });
    } catch (_) {}
  }

  /** After a section ends, user confirms starting the next one */
  function confirmPomoNext() {
    if (!pomoAwaiting) return;
    if (pomoAwaiting === "done") {
      setPomoAwaiting(null);
      pomoPhaseRef.current = "work";
      setPomoPhase("work");
      pomoCycleRef.current = 1;
      setPomoCycle(1);
      setRemainingMs(pomoWorkMs());
      setShowSettings(true);
      return;
    }
    if (pomoAwaiting === "break") {
      pomoPhaseRef.current = "break";
      setPomoPhase("break");
      setPomoTip(pickPomoHealthTip("break"));
      setPomoAwaiting(null);
      const total = pomoBreakMs();
      setRemainingMs(total);
      endAtRef.current = Date.now() + total;
      // Logged as break session; goals only count work minutes
      sessionDurationRef.current = total;
      runningRef.current = true;
      setRunning(true);
      setShowSettings(false);
      startAmbient();
      return;
    }
    if (pomoAwaiting === "work") {
      pomoPhaseRef.current = "work";
      setPomoPhase("work");
      setPomoTip(pickPomoHealthTip("work"));
      setPomoAwaiting(null);
      const total = pomoWorkMs();
      setRemainingMs(total);
      endAtRef.current = Date.now() + total;
      sessionDurationRef.current = total;
      runningRef.current = true;
      setRunning(true);
      setShowSettings(false);
      startAmbient();
    }
  }

  function pause() {
    if (prefs.mode === "countdown" || prefs.mode === "pomodoro") {
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
    endCreditClock();
  }

  function reset() {
    // Restore to the value this session started with — do NOT kill bubble / PiP
    runningRef.current = false;
    setRunning(false);
    endAtRef.current = null;
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    setElapsedMs(0);
    setDoneFlash(false);
    setPomoAwaiting(null);
    stopAmbient();
    endCreditClock();

    let restore = 0;
    if (prefs.mode === "pomodoro") {
      pomoPhaseRef.current = "work";
      setPomoPhase("work");
      pomoCycleRef.current = 1;
      setPomoCycle(1);
      restore = baseDurationRef.current || pomoWorkMs();
      baseDurationRef.current = restore;
    } else if (prefs.mode === "countdown") {
      restore =
        baseDurationRef.current ||
        parseHms(hours, mins, secs) ||
        25 * 60 * 1000;
    } else {
      // stopwatch
      restore = 0;
    }
    setRemainingMs(restore);

    // Keep live state so bubble / mini window stay alive (paused at start value)
    try {
      saveLiveState({
        mode: prefs.mode,
        running: false,
        remainingMs: restore,
        elapsedMs: 0,
        endAt: null,
        startedAt: null,
        accumulated: 0,
        pomoPhase: "work",
        pomoCycle: 1,
        updatedAt: Date.now(),
      });
    } catch (_) {}
    // Do not open settings, do not clearLiveState, do not change viewMode
  }

  /** Apply a new duration (ms). Works while running — restarts the segment from the new total. */
  function applyNewDuration(totalMs) {
    const total = Math.max(0, Number(totalMs) || 0);
    // Credit time already spent on the previous duration before switching
    if (runningRef.current) endCreditClock();
    setRemainingMs(total);
    baseDurationRef.current = total;
    sessionDurationRef.current = total;
    if (runningRef.current && (prefs.mode === "countdown" || prefs.mode === "pomodoro")) {
      endAtRef.current = Date.now() + total;
      beginCreditClock();
      try {
        saveLiveState({
          mode: prefs.mode,
          running: true,
          remainingMs: total,
          endAt: endAtRef.current,
          pomoPhase: pomoPhaseRef.current,
          pomoCycle: pomoCycleRef.current,
          updatedAt: Date.now(),
        });
      } catch (_) {}
      broadcastState({ remainingMs: total, display: formatMs(total) });
    }
  }

  function applyDuration() {
    applyNewDuration(parseHms(hours, mins, secs));
  }

  /** Apply current pomodoro phase length (study or break) — works while running. */
  function applyPomoDuration() {
    const phase = pomoPhaseRef.current || "work";
    const mins =
      phase === "break"
        ? Math.max(1, Number(prefs.pomoBreakMin) || 5)
        : Math.max(1, Number(prefs.pomoWorkMin) || 25);
    applyNewDuration(mins * 60 * 1000);
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
          zIndex: 6000,
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
        zIndex: 6000,
        display: "flex",
        flexDirection: "column",
        background: bgCss,
        color: prefs.textColor,
        overflow: "auto",
        transition: "background 0.35s ease",
      }}
    >
      {/* Floating controls over the background — no header bar */}
      <div
        style={{
          position: "absolute",
          top: 12,
          insetInlineEnd: 12,
          zIndex: 5,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button type="button" onClick={() => setShowSettings(true)} style={{ ...btnGhost, padding: "8px 12px", fontSize: 13, whiteSpace: "nowrap" }}>
          {tr(isAr, "Settings", "إعدادات")}
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
        {isPomo && (
          <div style={{ fontSize: 14, fontWeight: 700, opacity: 0.85, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {pomoPhase === "break"
              ? tr(isAr, "Break", "راحة")
              : tr(isAr, "Study", "مذاكرة")}
            {" · "}
            {tr(isAr, `Cycle ${pomoCycle} / ${prefs.pomoCycles || 4}`, `دورة ${pomoCycle} / ${prefs.pomoCycles || 4}`)}
          </div>
        )}

        {/* Health tip for Pomodoro */}
        {isPomo && pomoTip && (
          <div
            style={{
              maxWidth: 380,
              fontSize: 13,
              lineHeight: 1.5,
              opacity: 0.88,
              textAlign: "center",
              padding: "8px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {tr(isAr, pomoTip.en, pomoTip.ar)}
          </div>
        )}

        {prefs.sessionTitle && String(prefs.sessionTitle).trim() && (
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              opacity: 0.9,
              marginBottom: 8,
              textAlign: "center",
              maxWidth: "90%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {String(prefs.sessionTitle).trim()}
          </div>
        )}

        <div
          style={{
            animation: doneFlash ? "timerPulse 0.6s ease 3" : undefined,
            transition: "font-size 0.2s ease, color 0.2s ease",
          }}
        >
          {prefs.flipDigits ? (
            <FlipClock
              text={displayText}
              color={prefs.textColor}
              fontFamily={fontCss}
              fontSize={`clamp(42px, ${Math.max(8, prefs.fontSize * 0.12)}vw, ${prefs.fontSize}px)`}
            />
          ) : (
            <div
              style={{
                fontFamily: fontCss,
                fontSize: `clamp(42px, ${Math.max(8, prefs.fontSize * 0.12)}vw, ${prefs.fontSize}px)`,
                fontWeight: 700,
                letterSpacing: "0.03em",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                textShadow: isLightBg ? "none" : "0 4px 40px rgba(0,0,0,0.35)",
              }}
            >
              {displayText}
            </div>
          )}
        </div>

        {doneFlash && !pomoAwaiting && (
          <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.95 }}>
            {tr(isAr, "Time's up!", "انتهى الوقت!")}
          </div>
        )}

        {pomoAwaiting && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, maxWidth: 360, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.95 }}>
              {pomoAwaiting === "break"
                ? tr(isAr, "Study section done — start break when ready.", "خلصت المذاكرة — ابدأ الراحة لما تكون جاهز.")
                : pomoAwaiting === "work"
                ? tr(isAr, "Break over — start the next study cycle when ready.", "الراحة خلصت — ابدأ دورة المذاكرة الجاية لما تكون جاهز.")
                : tr(isAr, "All cycles complete. Great work!", "كل الدورات خلصت. شغل ممتاز!")}
            </div>
            {pomoTip && pomoAwaiting !== "done" && (
              <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>
                {tr(isAr, pomoTip.en, pomoTip.ar)}
              </div>
            )}
            <button type="button" onClick={confirmPomoNext} style={btnPrimary}>
              {pomoAwaiting === "break"
                ? tr(isAr, "Start break", "ابدأ الراحة")
                : pomoAwaiting === "work"
                ? tr(isAr, "Start next study", "ابدأ المذاكرة الجاية")
                : tr(isAr, "Done", "تم")}
            </button>
          </div>
        )}

        {/* Today total + 24h session history */}
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            marginTop: 4,
            padding: "12px 14px",
            borderRadius: 14,
            background: "rgba(0,0,0,0.22)",
            border: "1px solid rgba(255,255,255,0.1)",
            textAlign: "start",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {tr(isAr, "Today", "اليوم")}: {todayTotalMin} {tr(isAr, "min study", "د مذاكرة")}
            </span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              {tr(isAr, "Last 24h log", "سجل ٢٤ ساعة")}: {last24hMin} {tr(isAr, "min", "د")}
            </span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8 }}>
            {tr(isAr, "Session history auto-clears after 24 hours.", "سجل الجلسات بيتمسح تلقائي بعد ٢٤ ساعة.")}
          </div>
          {sessionLog.length === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {tr(isAr, "No sessions in the last 24 hours yet.", "مفيش جلسات في آخر ٢٤ ساعة لسه.")}
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6, maxHeight: 140, overflowY: "auto" }}>
              {sessionLog.slice(0, 12).map((s) => {
                const time = new Date(s.at).toLocaleTimeString(isAr ? "ar-EG" : "en-US", { hour: "2-digit", minute: "2-digit" });
                const kind =
                  s.mode === "pomodoro"
                    ? s.phase === "break"
                      ? tr(isAr, "Pomodoro break", "راحة بومودورو")
                      : tr(isAr, "Pomodoro study", "مذاكرة بومودورو")
                    : tr(isAr, "Timer", "تايمر");
                return (
                  <li key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, opacity: 0.9 }}>
                    <span>
                      {time} · {kind}
                      {s.mode === "pomodoro" && s.cycle ? ` #${s.cycle}` : ""}
                    </span>
                    <span style={{ fontWeight: 700 }}>{s.minutes} {tr(isAr, "min", "د")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {!pomoAwaiting && (
            !running ? (
              <button type="button" onClick={start} style={btnPrimary}>
                {tr(isAr, "Start", "ابدأ")}
              </button>
            ) : (
              <button type="button" onClick={pause} style={btnPrimary}>
                {tr(isAr, "Pause", "إيقاف مؤقت")}
              </button>
            )
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

      {/* Settings modal — portaled to body so timer digits / page text never stack above it */}
      {showSettings && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr(isAr, "Timer settings", "إعدادات المؤقّت")}
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            isolation: "isolate",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "min(88vh, 820px)",
              borderRadius: 18,
              // Fully opaque so nothing behind the modal bleeds through
              background: isLightBg ? "#fbf7ef" : "#0c1016",
              border: `1px solid ${panelBorder}`,
              boxShadow: "0 24px 60px -16px rgba(0,0,0,0.55)",
              color: prefs.textColor,
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header is outside the scroll area so nothing ever appears above it */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
                zIndex: 2,
                background: isLightBg ? "#fbf7ef" : "#0c1016",
                padding: "16px 18px 12px",
                borderBottom: `1px solid ${panelBorder}`,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.02em" }}>
                {tr(isAr, "Timer settings", "إعدادات المؤقّت")}
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label={tr(isAr, "Close", "إغلاق")}
                style={{
                  border: "none",
                  background: panelBg,
                  cursor: "pointer",
                  color: prefs.textColor,
                  width: 36,
                  height: 36,
                  padding: 0,
                  borderRadius: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  lineHeight: 0,
                  opacity: 0.9,
                }}
              >
                <XIcon size={18} />
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                padding: "16px 18px 24px",
                flex: 1,
                minHeight: 0,
              }}
            >
            {/* Mode */}
            <section>
              <Label muted={muted}>{tr(isAr, "Mode", "الوضع")}</Label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: "countdown", en: "Countdown", ar: "عدّ تنازلي" },
                  { id: "stopwatch", en: "Stopwatch", ar: "ساعة توقيت" },
                  { id: "pomodoro", en: "Pomodoro", ar: "بومودورو" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      if (m.id === prefs.mode) return;
                      setErrorMsg("");
                      // Switching mode always ends the current run and arms the new mode (ready, not running)
                      runningRef.current = false;
                      setRunning(false);
                      endAtRef.current = null;
                      startedAtRef.current = null;
                      accumulatedRef.current = 0;
                      setElapsedMs(0);
                      setDoneFlash(false);
                      setPomoAwaiting(null);
                      stopAmbient();
                      endCreditClock();
                      updatePref({ mode: m.id });
                      if (m.id === "countdown") {
                        const total = parseHms(hours, mins, secs) || 25 * 60 * 1000;
                        setRemainingMs(total);
                        baseDurationRef.current = total;
                      } else if (m.id === "pomodoro") {
                        pomoPhaseRef.current = "work";
                        setPomoPhase("work");
                        pomoCycleRef.current = 1;
                        setPomoCycle(1);
                        const w = Math.max(1, Number(prefs.pomoWorkMin) || 25) * 60 * 1000;
                        setRemainingMs(w);
                        baseDurationRef.current = w;
                      } else {
                        setRemainingMs(0);
                        baseDurationRef.current = 0;
                      }
                      // Persist idle state so bubble / refresh match
                      try {
                        saveLiveState({
                          mode: m.id,
                          running: false,
                          remainingMs: m.id === "stopwatch" ? 0 : (m.id === "pomodoro"
                            ? Math.max(1, Number(prefs.pomoWorkMin) || 25) * 60 * 1000
                            : (parseHms(hours, mins, secs) || 25 * 60 * 1000)),
                          elapsedMs: 0,
                          endAt: null,
                          startedAt: null,
                          accumulated: 0,
                          pomoPhase: "work",
                          pomoCycle: 1,
                          updatedAt: Date.now(),
                        });
                      } catch (_) {}
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

            {/* Pomodoro setup */}
            {prefs.mode === "pomodoro" && (
              <section>
                <Label muted={muted}>{tr(isAr, "Pomodoro technique", "تقنية البومودورو")}</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {POMO_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        updatePref({ pomoWorkMin: p.work, pomoBreakMin: p.brk });
                        if (!running) {
                          pomoPhaseRef.current = "work";
                          setPomoPhase("work");
                          applyNewDuration(p.work * 60 * 1000);
                        } else {
                          // Running: apply length for the current phase
                          const phase = pomoPhaseRef.current || "work";
                          const mins = phase === "break" ? p.brk : p.work;
                          applyNewDuration(mins * 60 * 1000);
                        }
                      }}
                      style={{
                        ...btnGhost,
                        padding: "6px 12px",
                        fontSize: 12,
                        outline:
                          prefs.pomoWorkMin === p.work && prefs.pomoBreakMin === p.brk
                            ? `2px solid ${prefs.textColor}`
                            : "none",
                      }}
                    >
                      {tr(isAr, p.en, p.ar)}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <NumberStepper
                      min={1}
                      max={180}
                      value={prefs.pomoWorkMin || 25}
                      width={100}
                      onChange={(v) => {
                        updatePref({ pomoWorkMin: v });
                        if (!running && (pomoPhaseRef.current || "work") === "work") {
                          applyNewDuration(v * 60 * 1000);
                        }
                      }}
                      aria-label={tr(isAr, "Study minutes", "دقائق المذاكرة")}
                    />
                    <span style={{ fontSize: 11, opacity: 0.75 }}>{tr(isAr, "Study (min)", "مذاكرة (د)")}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <NumberStepper
                      min={1}
                      max={60}
                      value={prefs.pomoBreakMin || 5}
                      width={100}
                      onChange={(v) => {
                        updatePref({ pomoBreakMin: v });
                        if (!running && (pomoPhaseRef.current || "work") === "break") {
                          applyNewDuration(v * 60 * 1000);
                        }
                      }}
                      aria-label={tr(isAr, "Break minutes", "دقائق الراحة")}
                    />
                    <span style={{ fontSize: 11, opacity: 0.75 }}>{tr(isAr, "Break (min)", "راحة (د)")}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                    <NumberStepper
                      min={1}
                      max={12}
                      value={prefs.pomoCycles || 4}
                      width={100}
                      onChange={(v) => updatePref({ pomoCycles: v })}
                      aria-label={tr(isAr, "Cycles", "عدد الدورات")}
                    />
                    <span style={{ fontSize: 11, opacity: 0.75 }}>{tr(isAr, "Cycles", "دورات")}</span>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <button type="button" onClick={applyPomoDuration} style={{ ...btnGhost }}>
                    {tr(isAr, "Apply duration", "تطبيق المدة")}
                  </button>
                  <span style={{ fontSize: 11, opacity: 0.65 }}>
                    {tr(
                      isAr,
                      "Applies the current phase length (study or break), even while running.",
                      "بيطبّق مدة المرحلة الحالية (مذاكرة أو راحة)، حتى لو التايمر شغال."
                    )}
                  </span>
                </div>
                <p style={{ fontSize: 12, opacity: 0.7, margin: "10px 0 0", lineHeight: 1.5 }}>
                  {tr(
                    isAr,
                    "Break and next cycle start only when you confirm — never auto.",
                    "الراحة والدورة التالية بتبدأ لما توافق أنت — مش تلقائي."
                  )}
                </p>
              </section>
            )}

            {/* Session title */}
            <section>
              <Label muted={muted}>{tr(isAr, "Session title (optional)", "عنوان الجلسة (اختياري)")}</Label>
              <input
                type="text"
                value={prefs.sessionTitle || ""}
                onChange={(e) => updatePref({ sessionTitle: e.target.value.slice(0, 80) })}
                placeholder={tr(isAr, "e.g. Unit 3 vocabulary", "مثال: مفردات الوحدة 3")}
                maxLength={80}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(0,0,0,0.25)",
                  color: prefs.textColor || "#fff",
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
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
                        applyNewDuration(parseHms(p.h, p.m, p.s));
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

            {/* Digit style: plain vs flip cards */}
            <section>
              <Label muted={muted}>{tr(isAr, "Digit style", "شكل الأرقام")}</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => updatePref({ flipDigits: false })}
                  style={{
                    ...btnGhost,
                    outline: !prefs.flipDigits ? `2px solid ${prefs.textColor}` : "none",
                  }}
                >
                  {tr(isAr, "Normal", "عادي")}
                </button>
                <button
                  type="button"
                  onClick={() => updatePref({ flipDigits: true })}
                  style={{
                    ...btnGhost,
                    outline: prefs.flipDigits ? `2px solid ${prefs.textColor}` : "none",
                  }}
                >
                  {tr(isAr, "Flip cards", "كروت قلّابة")}
                </button>
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
                {BG_PRESETS.map((b) => {
                  const unlocked = isThemeUnlocked(b.id, xpTotal);
                  const needLevel = themeUnlockLevel(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        if (!unlocked) return;
                        updatePref({ bgId: b.id, customBg: null });
                      }}
                      title={
                        unlocked
                          ? tr(isAr, b.label.en, b.label.ar)
                          : tr(isAr, `Unlocks at level ${needLevel}`, `ينفتح عند المستوى ${needLevel}`)
                      }
                      style={{
                        height: 56,
                        borderRadius: 12,
                        border: prefs.bgId === b.id && !prefs.customBg ? `2px solid ${prefs.textColor}` : `1px solid ${panelBorder}`,
                        background: b.value,
                        cursor: unlocked ? "pointer" : "not-allowed",
                        boxShadow: "0 4px 12px -6px rgba(0,0,0,0.35)",
                        position: "relative",
                        opacity: unlocked ? 1 : 0.55,
                        overflow: "hidden",
                      }}
                    >
                      {!unlocked && (
                        <span
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(0,0,0,0.45)",
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 700,
                            gap: 2,
                            padding: 4,
                            lineHeight: 1.2,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>🔒</span>
                          <span>{tr(isAr, `Lv ${needLevel}`, `م ${needLevel}`)}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
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
        </div>,
        document.body
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
