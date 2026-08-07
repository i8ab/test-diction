import { Component } from "react";

// Catches render/lifecycle errors anywhere below it in the tree and shows a
// small fallback screen instead of a blank white page. Without this, any
// unexpected exception (bad data from the cloud store, a null entry, etc.)
// unmounts the *entire* app with nothing shown to the user and nothing
// logged anywhere they can see.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info && info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

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
