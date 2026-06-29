import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch, discoverBot } from "../api";
import DOMPurify from "dompurify";
import {
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const ACCENT = "#7c5cff";
const BLURPLE = "#5865F2";
const VERSION = "v2.0.0";

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [botId, setBotId] = useState(localStorage.getItem("last_bot_id") || "");
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await apiFetch("/auth/me");
        if (res.ok) navigate("/dashboard");
      } catch (err) {
        // Non connecté.
      }
    };
    if (sessionStorage.getItem("bot_port")) checkLogin();
  }, [navigate]);

  const handleConnect = async () => {
    if (!botId || !phrase) {
      setError(t("login.error_empty"));
      return;
    }

    setLoading(true);
    setError("");

    const result = await discoverBot(botId);

    if (result.success) {
      localStorage.setItem("last_bot_id", botId);
      try {
        const authRes = await apiFetch("/auth/phrase", {
          method: "POST",
          body: JSON.stringify({ phrase }),
        });

        if (authRes.ok) {
          navigate("/dashboard");
        } else {
          const data = await authRes.json();
          setError(data.error || t("login.phrase_error"));
        }
      } catch (authErr) {
        setError(t("login.error_conn"));
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const features = [
    {
      icon: Zap,
      title: "Temps réel",
      desc: "Changements appliqués sans redémarrage.",
    },
    {
      icon: ShieldCheck,
      title: "Anti-raid",
      desc: "Filtres et seuils granulaires.",
    },
    {
      icon: BarChart3,
      title: "Métriques",
      desc: "Activité et commandes en un graphe.",
    },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0f] text-zinc-100 font-sans selection:bg-[#7c5cff] selection:text-white">
      <a href="#login-main" className="skip-to-content">
        Aller au contenu principal
      </a>
      {/* Background — 2 soft radial blobs + faint grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-48 left-[15%] h-[560px] w-[560px] rounded-full blur-[140px] opacity-30"
          style={{
            background: `radial-gradient(circle, ${ACCENT} 0%, transparent 65%)`,
          }}
        />
        <div
          className="absolute bottom-[-240px] right-[5%] h-[520px] w-[520px] rounded-full blur-[140px] opacity-20"
          style={{
            background: `radial-gradient(circle, ${BLURPLE} 0%, transparent 65%)`,
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 sm:px-6 py-8 md:py-10">
        {/* Top nav */}
        <nav className="flex items-center justify-between opacity-0 animate-[fadeIn_0.8s_ease-out_forwards]">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-lg ring-1 ring-white/10"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${BLURPLE})`,
              }}
              aria-hidden="true"
            >
              <Terminal size={15} strokeWidth={2.4} />
            </div>
            <span className="text-sm font-semibold tracking-tight">Aegis</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-xs text-zinc-400">
            <Link
              to="/doc"
              className="rounded-md transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60"
            >
              {t("doc.title")}
            </Link>
            <a
              href="https://discord.gg/invite"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md transition-colors hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60"
            >
              {t("dashboard.support")}
            </a>
          </div>
        </nav>

        {/* Hero */}
        <main
          id="login-main"
          className="flex flex-1 flex-col items-center justify-center py-20 text-center opacity-0 animate-[fadeIn_1s_ease-out_0.15s_forwards] md:py-28"
        >
          {/* Error banner — top-of-hero */}
          {error && (
            <div
              role="alert"
              className="mb-8 flex w-full max-w-md items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left animate-[slideDown_0.3s_ease-out]"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-red-400"
                aria-hidden="true"
              />
              <span
                className="text-sm leading-relaxed text-red-200"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(error) }}
              />
            </div>
          )}

          <h1 className="text-[2.75rem] font-bold tracking-tight sm:text-6xl md:text-[5.5rem]">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${ACCENT} 110%)`,
              }}
            >
              Aegis
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base text-zinc-400 sm:text-lg">
            Configure ton serveur Discord en quelques clics.
          </p>

          {/* Login card */}
          <div className="mt-12 w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.025] p-6 backdrop-blur-sm shadow-[0_30px_80px_-30px_rgba(124,92,255,0.35)]">
            <div className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="bot-id"
                  className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
                >
                  Identifiant
                </label>
                <input
                  id="bot-id"
                  type="text"
                  autoComplete="username"
                  value={botId}
                  onChange={(e) => setBotId(e.target.value)}
                  placeholder="ZeroDay1"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all focus:border-[#7c5cff]/60 focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/30"
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="bot-phrase"
                  className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
                >
                  Phrase
                </label>
                <input
                  id="bot-phrase"
                  type="password"
                  autoComplete="current-password"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="••••••••••••"
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 transition-all focus:border-[#7c5cff]/60 focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/30"
                />
              </div>

              <button
                onClick={handleConnect}
                disabled={loading}
                aria-busy={loading}
                aria-label={t("login.submit")}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5865F2]/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]"
                style={{ background: BLURPLE }}
              >
                {loading ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-hidden="true"
                  />
                ) : (
                  <>
                    <span>{t("login.submit")}</span>
                    <ArrowRight
                      size={15}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>

              <p className="pt-1 text-center text-[10px] uppercase tracking-wider text-zinc-600">
                {t("login.e2e")}
              </p>
            </div>
          </div>

          {/* Feature highlights — 3 cards, minimal */}
          <section
            aria-label="Capacités"
            className="mt-24 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3"
          >
            {features.map(({ icon: Icon, title, desc }) => (
              <article
                key={title}
                className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#7c5cff]/40 hover:bg-white/[0.04]"
              >
                <div
                  className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg text-[#c4b5ff] ring-1 ring-[#7c5cff]/30"
                  style={{ background: "rgba(124,92,255,0.10)" }}
                  aria-hidden="true"
                >
                  <Icon size={15} strokeWidth={2.2} />
                </div>
                <h2 className="text-sm font-semibold text-white">{title}</h2>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  {desc}
                </p>
              </article>
            ))}
          </section>
        </main>

        {/* Footer — tight */}
        <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-5 text-[11px] text-zinc-500 md:flex-row opacity-0 animate-[fadeIn_1s_ease-out_0.4s_forwards]">
          <span className="font-mono">Aegis {VERSION}</span>
          <div className="flex items-center gap-5">
            <Link
              to="/doc"
              className="transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60 rounded-md"
            >
              {t("doc.title")}
            </Link>
            <a
              href="https://discord.gg/invite"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60 rounded-md"
            >
              {t("dashboard.support")}
            </a>
          </div>
        </footer>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `,
        }}
      />
    </div>
  );
};

export default Login;
