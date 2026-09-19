import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./App";

/* Last line of defence: an uncaught render error must never leave a blank
   white page. Show a readable recovery card instead (and offer a reload). */
class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Uncaught render error:", error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-full items-center justify-center p-6">
          <div className="glass-strong w-full max-w-md rounded-3xl p-6 text-center">
            <p className="text-sm font-bold text-ink-900">Something went wrong</p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={this.handleReload}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-5 py-2.5 text-xs font-bold text-ink-950 hover:brightness-110"
            >
              Reload the app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);