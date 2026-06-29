import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Lock, Copy, Check, Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api";

const ACCENT = "#7c5cff";
const BLURPLE = "#5865F2";

// Code block with copy-to-clipboard + transient "Copié" toast.
function CodeBlock({ children, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        typeof children === "string" ? children : String(children),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refusé.
    }
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-white/10 bg-black/50">
      <div
        className="absolute inset-y-0 left-0 w-[2px]"
        style={{ background: ACCENT }}
        aria-hidden="true"
      />
      <pre className="overflow-x-auto py-3 pl-5 pr-14 font-mono text-[12.5px] leading-relaxed text-zinc-200">
        <code>{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copié" : `Copier ${label || "le code"}`}
        className="absolute right-2 top-2 flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-zinc-900/80 px-2 text-[11px] text-zinc-400 opacity-0 transition-all hover:text-zinc-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60"
      >
        {copied ? (
          <>
            <Check size={12} className="text-emerald-400" aria-hidden="true" />
            <span>Copié</span>
          </>
        ) : (
          <>
            <Copy size={12} aria-hidden="true" />
            <span>Copier</span>
          </>
        )}
      </button>
    </div>
  );
}

// Command syntax: prefix muted, name accent, args subtle.
function CommandSyntax({ prefix = "+", name, args }) {
  return (
    <code className="inline-flex items-baseline gap-1 rounded-md border border-white/10 bg-black/50 px-2 py-1 font-mono text-[12px]">
      <span className="text-zinc-500">{prefix}</span>
      <span className="font-semibold" style={{ color: "#c4b5ff" }}>
        {name}
      </span>
      {args && <span className="text-zinc-500">{args}</span>}
    </code>
  );
}

export default function Doc() {
  const { t } = useTranslation();
  const [commands, setCommands] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("");
  const contentRef = useRef(null);

  useEffect(() => {
    // Use apiFetch so the call honors the configured bot port / gateway
    // (plain `/api/commands` would 404 in dev where vite serves on 5173).
    apiFetch("/commands")
      .then((res) => {
        if (!res.ok) throw new Error("API Response Error");
        return res.json();
      })
      .then((data) => {
        setCommands(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setCommands([]);
        setLoading(false);
      });
  }, []);

  // Group by category, preserve discovery order.
  const sections = useMemo(() => {
    const map = new Map();
    for (const cmd of commands) {
      const cat = cmd.category || "Général";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(cmd);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      id: `section-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      category,
      items,
    }));
  }, [commands]);

  // Filter on name + aliases + description + category.
  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sections;
    return sections
      .map((s) => ({
        ...s,
        items: s.items.filter(
          (cmd) =>
            cmd.name.toLowerCase().includes(q) ||
            (cmd.description || "").toLowerCase().includes(q) ||
            (cmd.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
            s.category.toLowerCase().includes(q),
        ),
      }))
      .filter((s) => s.items.length > 0);
  }, [sections, search]);

  // Scroll-spy.
  useEffect(() => {
    if (!filteredSections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 },
    );
    filteredSections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [filteredSections]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalCount = useMemo(() => commands.length, [commands]);

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-zinc-100 font-sans selection:bg-[#7c5cff] selection:text-white">
      <a href="#doc-main" className="skip-to-content">
        Aller au contenu principal
      </a>
      {/* Background — soft orb + faint grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-48 right-[8%] h-[480px] w-[480px] rounded-full blur-[140px] opacity-25"
          style={{
            background: `radial-gradient(circle, ${ACCENT} 0%, transparent 65%)`,
          }}
        />
        <div
          className="absolute bottom-[-200px] left-[5%] h-[440px] w-[440px] rounded-full blur-[140px] opacity-15"
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
              "radial-gradient(ellipse at top, black 50%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, black 50%, transparent 90%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-10 md:py-14">
        <Link
          to="/dashboard"
          className="group inline-flex items-center gap-2 rounded-md text-xs font-medium text-zinc-400 transition-colors hover:text-[#c4b5ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60"
        >
          <ArrowLeft
            size={14}
            className="transition-transform group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          Retour au dashboard
        </Link>

        {/* Header */}
        <header className="mt-8 mb-10">
          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: `linear-gradient(180deg, #ffffff 0%, ${ACCENT} 120%)`,
                }}
              >
                Documentation
              </span>
            </h1>
            {!loading && totalCount > 0 && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                {totalCount}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Référence complète des commandes Aegis.
          </p>

          {/* Search */}
          <div className="relative mt-7 max-w-xl">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              size={16}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Filtrer par nom, alias, catégorie."
              aria-label="Rechercher une commande"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 transition-all focus:border-[#7c5cff]/60 focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-white/10"
              style={{ borderTopColor: ACCENT }}
              aria-hidden="true"
            />
            <span className="text-xs text-zinc-500">
              Chargement des commandes.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
            {/* Sticky sidebar TOC */}
            <aside className="hidden lg:block" aria-label="Table des matières">
              <nav className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
                <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Catégories
                </h2>
                <ul className="space-y-0.5">
                  {filteredSections.map((s) => {
                    const active = activeSection === s.id;
                    return (
                      <li key={s.id} className="relative">
                        {active && (
                          <span
                            className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                            style={{ background: ACCENT }}
                            aria-hidden="true"
                          />
                        )}
                        <button
                          onClick={() => scrollToSection(s.id)}
                          className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60 ${
                            active
                              ? "text-[#c4b5ff]"
                              : "text-zinc-500 hover:text-zinc-200"
                          }`}
                        >
                          <span className="truncate">{s.category}</span>
                          <span className="ml-2 shrink-0 font-mono text-[10px] text-zinc-600">
                            {s.items.length}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {filteredSections.length === 0 && (
                    <li className="px-3 py-2 text-xs text-zinc-600">
                      Aucune section.
                    </li>
                  )}
                </ul>
              </nav>
            </aside>

            {/* Main reading column */}
            <main id="doc-main" ref={contentRef} className="max-w-3xl">
              {filteredSections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
                  <Search
                    size={28}
                    className="mx-auto text-zinc-700"
                    aria-hidden="true"
                  />
                  <p className="mt-4 text-sm text-zinc-400">
                    Aucune commande trouvée.
                  </p>
                  {search && (
                    <p className="mt-1 font-mono text-xs text-zinc-600">
                      "{search}"
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-16">
                  {filteredSections.map((section) => (
                    <section
                      key={section.id}
                      id={section.id}
                      className="scroll-mt-8"
                    >
                      <h2 className="group mb-5 flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <a
                          href={`#${section.id}`}
                          aria-label={`Lien d'ancrage vers ${section.category}`}
                          className="text-zinc-600 opacity-0 transition-opacity hover:text-[#c4b5ff] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                        >
                          <Hash size={18} aria-hidden="true" />
                        </a>
                        <span>{section.category}</span>
                        <span className="ml-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-400">
                          {section.items.length}
                        </span>
                      </h2>

                      {/* Bordered summary table */}
                      <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full min-w-[320px] text-left text-sm">
                          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                            <tr>
                              <th
                                scope="col"
                                className="px-4 py-2.5 font-medium"
                              >
                                Commande
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-2.5 font-medium"
                              >
                                Description
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.items.map((cmd, idx) => (
                              <tr
                                key={cmd.name}
                                className={`border-t border-white/5 align-top ${
                                  idx % 2 === 1 ? "bg-white/[0.018]" : ""
                                }`}
                              >
                                <td className="px-4 py-3 align-top">
                                  <a
                                    href={`#cmd-${cmd.name}`}
                                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60 rounded-md"
                                  >
                                    <CommandSyntax name={cmd.name} />
                                  </a>
                                </td>
                                <td className="px-4 py-3 text-[13px] text-zinc-400">
                                  {cmd.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Per-command cards */}
                      <div className="mt-6 space-y-3">
                        {section.items.map((cmd) => (
                          <article
                            key={`${cmd.name}-detail`}
                            id={`cmd-${cmd.name}`}
                            className="scroll-mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/15"
                          >
                            {/* Header: command syntax */}
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                              <code className="font-mono text-base font-semibold">
                                <span className="text-zinc-500">+</span>
                                <span style={{ color: "#c4b5ff" }}>
                                  {cmd.name}
                                </span>
                                {cmd.usage && (
                                  <span className="ml-1 text-zinc-500">
                                    {cmd.usage}
                                  </span>
                                )}
                              </code>
                              {cmd.aliases && cmd.aliases.length > 0 && (
                                <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                                  <span className="uppercase tracking-wider">
                                    Alias
                                  </span>
                                  {cmd.aliases.map((a) => (
                                    <code
                                      key={a}
                                      className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-zinc-400"
                                    >
                                      +{a}
                                    </code>
                                  ))}
                                </span>
                              )}
                            </div>

                            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                              {cmd.description}
                            </p>

                            <div className="mt-4 space-y-3 text-sm">
                              <div>
                                <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                                  Utilisation
                                </div>
                                <CodeBlock label={`utilisation de ${cmd.name}`}>
                                  {`+${cmd.name}${cmd.usage ? " " + cmd.usage : ""}`}
                                </CodeBlock>
                              </div>

                              {cmd.userPermissions &&
                                cmd.userPermissions.length > 0 && (
                                  <div className="flex items-start gap-2 text-xs text-zinc-400">
                                    <Lock
                                      size={12}
                                      className="mt-0.5 text-zinc-500"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      <span className="uppercase tracking-wider text-zinc-500">
                                        Requis
                                      </span>{" "}
                                      <span className="text-zinc-300">
                                        {cmd.userPermissions.join(", ")}
                                      </span>
                                    </span>
                                  </div>
                                )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </main>
          </div>
        )}

        <footer className="mt-20 flex flex-col items-center justify-between gap-3 border-t border-white/5 py-6 text-[11px] text-zinc-500 md:flex-row">
          <span className="font-mono">Aegis v2.0.0</span>
          <div className="flex gap-5">
            <span>AES-256</span>
            <span>WSS / HTTPS</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
