import { Component } from "react";

// Catches render/lifecycle errors anywhere below it in the tree and shows a
// recovery screen instead of a blank page. Without this, any unexpected
// exception unmounts the entire app with nothing shown to the user.
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

    const isAr =
      (typeof document !== "undefined" &&
        (document.documentElement.lang === "ar" ||
          document.documentElement.dir === "rtl")) ||
      false;

    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, 'Source Sans 3', sans-serif",
          background: "var(--paper, #0b0f14)",
          color: "var(--ink, #e6e9ee)",
        }}
        dir={isAr ? "rtl" : "ltr"}
      >
        <div style={{ fontSize: 40 }} aria-hidden="true">
          ⚠️
        </div>
        <h1 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>
          {isAr ? "حصل خطأ غير متوقع" : "Something went wrong"}
        </h1>
        <p
          style={{
            fontSize: 14,
            opacity: 0.75,
            maxWidth: 420,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          {isAr
            ? "التطبيق توقف عن عرض هذه الشاشة حتى لا يتأثر بياناتك. جرب إعادة المحاولة أو تحديث الصفحة — بياناتك محفوظة على السيرفر."
            : "The app hit an unexpected error and stopped this screen so nothing gets corrupted. Try again or reload — your data is stored server-side."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {isAr ? "حاول مرة أخرى" : "Try again"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#4c8dff",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {isAr ? "تحديث الصفحة" : "Reload page"}
          </button>
        </div>
        {error && error.message && (
          <details
            style={{
              fontSize: 11,
              opacity: 0.5,
              marginTop: 8,
              maxWidth: 480,
              width: "100%",
            }}
          >
            <summary style={{ cursor: "pointer" }}>
              {isAr ? "تفاصيل الخطأ" : "Error details"}
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                textAlign: "left",
                direction: "ltr",
              }}
            >
              {String(error.message)}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
