import { Component } from "react";

const RELOAD_KEY = "twoTongues.chunkReloadOnce";

/** Stale Vite/JS chunk after a deploy — old shell asks for a hashed file that no longer exists. */
function isChunkLoadError(error) {
  const msg = String((error && error.message) || error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\d]+ failed|ChunkLoadError|error loading dynamically imported module/i.test(
    msg
  );
}

function tryAutoReloadForChunkError(error) {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  try {
    // Only once per tab session to avoid an infinite reload loop
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch (_) {
    // sessionStorage blocked — still attempt one reload via navigation
  }
  window.location.reload();
  return true;
}

// Clear the flag after a successful load so a future deploy can recover again
if (typeof window !== "undefined") {
  try {
    // After the page has been up for a moment without crashing, allow a future auto-reload
    window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch (_) {}
    }, 8000);
  } catch (_) {}
}

// Catches render/lifecycle errors anywhere below it in the tree and shows a
// small fallback screen instead of a blank white page. Without this, any
// unexpected exception (bad data from the cloud store, a null entry, etc.)
// unmounts the *entire* app with nothing shown to the user and nothing
// logged anywhere they can see.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, autoReloading: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info && info.componentStack);

    if (tryAutoReloadForChunkError(error)) {
      this.setState({ autoReloading: true });
    }
  }

  handleReset = () => {
    this.setState({ error: null, autoReloading: false });
  };

  render() {
    const { error, autoReloading } = this.state;
    if (!error) return this.props.children;

    if (autoReloading || isChunkLoadError(error)) {
      // Brief message while the page reloads for a stale deploy chunk
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#0b0f14",
            color: "#e6e9ee",
          }}
        >
          <div style={{ fontSize: 36 }}>🔄</div>
          <h1 style={{ fontSize: 17, margin: 0 }}>Updating…</h1>
          <p style={{ fontSize: 13.5, opacity: 0.7, maxWidth: 380, margin: 0 }}>
            A new version of the app was deployed. Reloading to load the latest files…
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#4c8dff",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload now
          </button>
        </div>
      );
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0f14",
          color: "#e6e9ee",
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontSize: 18, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, opacity: 0.75, maxWidth: 420, margin: 0 }}>
          The app hit an unexpected error and had to stop this screen so nothing
          gets corrupted. Reloading usually fixes it — your data is stored
          server-side, not lost.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={this.handleReset}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#4c8dff",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
        </div>
        {error && error.message && (
          <details style={{ fontSize: 11, opacity: 0.5, marginTop: 8, maxWidth: 480 }}>
            <summary style={{ cursor: "pointer" }}>Error details</summary>
            <pre style={{ whiteSpace: "pre-wrap", textAlign: "left" }}>{error.message}</pre>
          </details>
        )}
      </div>
    );
  }
}
