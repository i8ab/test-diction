/**
 * Push prefs + multi-device helpers
 * Messages & settings live on the server → synced across devices.
 */

const API = "/api/push-subscribe";

export async function fetchPushPrefs(code) {
  if (!code) return null;
  try {
    const res = await fetch(`${API}?code=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ...data.prefs,
      devices: data.devices || 0,
      inbox: data.inbox || [],
      unread: data.unread || 0,
    };
  } catch (err) {
    console.warn("fetchPushPrefs", err);
    return null;
  }
}

export async function savePushPrefs(code, prefs) {
  if (!code) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "savePrefs", code, prefs }),
    });
    const data = await res.json();
    return data.prefs;
  } catch (err) {
    console.warn("savePushPrefs", err);
    return null;
  }
}

/** Clear only the reminder messages list (synced) */
export async function clearReminderMessages(code) {
  if (!code) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearMessages", code }),
    });
    const data = await res.json();
    return data.prefs;
  } catch (err) {
    console.warn("clearReminderMessages", err);
    return null;
  }
}

export async function clearSchedule(code) {
  if (!code) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearSchedule", code }),
    });
    const data = await res.json();
    return data.prefs;
  } catch (err) {
    console.warn("clearSchedule", err);
    return null;
  }
}

export async function subscribePush(code, subscription) {
  if (!code || !subscription) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", code, subscription }),
    });
    return res.json();
  } catch (err) {
    console.warn("subscribePush", err);
    return null;
  }
}

export async function unsubscribePush(code, endpoint) {
  if (!code || !endpoint) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsubscribe", code, endpoint }),
    });
    return res.json();
  } catch (err) {
    console.warn("unsubscribePush", err);
    return null;
  }
}
