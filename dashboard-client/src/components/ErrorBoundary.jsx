import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
    this.handleReload = this.handleReload.bind(this);
    this.handleCopy = this.handleCopy.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReload() {
    window.location.reload();
  }

  async handleCopy() {
    const { error, errorInfo } = this.state;
    const payload = [
      `Message: ${error?.message ?? "Erreur inconnue"}`,
      "",
      "Stack:",
      error?.stack ?? "(non disponible)",
      "",
      "Component stack:",
      errorInfo?.componentStack ?? "(non disponible)",
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else {
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ErrorBoundary] copy failed", e);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, copied } = this.state;
    const message = error?.message || "Une erreur inattendue est survenue.";

    return (
      <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex items-center justify-center px-4 py-10">
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-xl rounded-2xl bg-neutral-900/90 ring-1 ring-accent-500/40 shadow-glow p-6 sm:p-8 backdrop-blur"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full bg-accent-500 shadow-[0_0_12px_2px_rgba(124,92,255,0.6)]"
            />
            <h1 className="text-lg sm:text-xl font-semibold tracking-tightish text-neutral-50">
              Oups, quelque chose s'est mal passe
            </h1>
          </div>

          <p className="mt-3 text-sm text-neutral-300">
            L'interface a rencontre une erreur et n'a pas pu s'afficher
            correctement. Vous pouvez recharger la page ou copier le detail
            technique pour le signaler.
          </p>

          <div className="mt-5 rounded-lg bg-neutral-950/80 ring-1 ring-neutral-800 px-3 py-2.5">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Message
            </p>
            <p className="mt-1 font-mono text-sm text-accent-200 break-words">
              {message}
            </p>
          </div>

          {errorInfo?.componentStack ? (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200 select-none">
                Afficher la pile des composants
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-neutral-950/80 ring-1 ring-neutral-800 p-3 text-[11px] leading-relaxed text-neutral-400 font-mono whitespace-pre-wrap">
                {errorInfo.componentStack.trim()}
              </pre>
            </details>
          ) : null}

          <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-lg bg-accent-500 hover:bg-accent-400 active:bg-accent-600 text-white text-sm font-medium px-4 py-2.5 ring-1 ring-accent-400/60 shadow-soft transition focus:outline-none focus:ring-2 focus:ring-accent-300"
            >
              Recharger la page
            </button>
            <button
              type="button"
              onClick={this.handleCopy}
              className="inline-flex items-center justify-center rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-sm font-medium px-4 py-2.5 ring-1 ring-neutral-700 transition focus:outline-none focus:ring-2 focus:ring-accent-400/60"
            >
              {copied ? "Detail copie" : "Copier le detail"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
