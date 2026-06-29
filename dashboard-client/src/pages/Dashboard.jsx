import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import {
  Plus,
  LogOut,
  Search,
  RefreshCw,
  Settings,
  X,
  Save,
  Activity,
  User,
  Globe,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

const ACCENT = "#7c5cff";
const VERSION = "v1.0";
const numberFr = new Intl.NumberFormat("fr-FR");

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isGlobalOwner, setIsGlobalOwner] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [botStatus, setBotStatus] = useState("online");
  const [botActivityName, setBotActivityName] = useState("");
  const [botActivityType, setBotActivityType] = useState("0");
  const [botUsername, setBotUsername] = useState("");
  const [botAvatar, setBotAvatar] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState({
    type: "",
    text: "",
  });

  const [speedPhrases, setSpeedPhrases] = useState([]);
  const [newPhrase, setNewPhrase] = useState("");
  const [newPhraseName, setNewPhraseName] = useState("");

  const [botName, setBotName] = useState("Aegis");

  const modalRef = useRef(null);
  const closeBtnRef = useRef(null);
  const lastFocusedRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Focus trap + restore + Escape close
  useEffect(() => {
    if (!isSettingsOpen) return;
    lastFocusedRef.current = document.activeElement;
    closeBtnRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        setIsSettingsOpen(false);
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll(
        'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocusedRef.current?.focus?.();
    };
  }, [isSettingsOpen]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const authRes = await apiFetch("/auth/me");
      if (authRes.ok) {
        const authData = await authRes.json();
        setIsGlobalOwner(authData.isGlobalOwner || false);
        if (authData.isGlobalOwner) {
          const spRes = await apiFetch("/system/speedphrases");
          if (spRes.ok) setSpeedPhrases(await spRes.json());
        }
      }

      // botName is exposed by /identify (auth/me has no such field)
      try {
        const idRes = await apiFetch("/identify");
        if (idRes.ok) {
          const idData = await idRes.json();
          if (idData.botName) setBotName(idData.botName);
        }
      } catch {
        /* identify is best-effort; fall back to default name */
      }

      const res = await apiFetch("/user/guilds");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // Surface reqId from body (5xx) or X-Request-Id header so the user
        // can quote it when filing a bug.
        const reqId = errorData.reqId || res.reqId;
        const base = errorData.details || errorData.error || "Chargement impossible.";
        throw new Error(reqId ? `${base} [ID: ${reqId}]` : base);
      }
      const data = await res.json();
      setGuilds(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage({ type: "", text: "" });
    try {
      await apiFetch("/bot/presence", {
        method: "PATCH",
        body: JSON.stringify({
          status: botStatus,
          activityName: botActivityName,
          activityType: botActivityType,
        }),
      });

      if (botUsername || botAvatar) {
        const profileRes = await apiFetch("/bot/profile", {
          method: "PATCH",
          body: JSON.stringify({
            username: botUsername,
            avatar: botAvatar,
          }),
        });
        if (!profileRes.ok)
          throw new Error("Limite Discord atteinte. Modifie le statut seul.");
      }

      setSettingsMessage({ type: "success", text: t("notifications.settings_saved") });
      setTimeout(() => setIsSettingsOpen(false), 1200);
    } catch (err) {
      setSettingsMessage({
        type: "error",
        text: err.message || t("notifications.error_save"),
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddSpeedPhrase = async () => {
    if (!newPhrase || !newPhraseName) return;
    try {
      await apiFetch("/system/speedphrases", {
        method: "POST",
        body: JSON.stringify({ phrase: newPhrase, name: newPhraseName }),
      });
      const spRes = await apiFetch("/system/speedphrases");
      if (spRes.ok) setSpeedPhrases(await spRes.json());
      setNewPhrase("");
      setNewPhraseName("");
    } catch (err) {
      setSettingsMessage({ type: "error", text: "Ajout impossible." });
    }
  };

  const handleDeleteSpeedPhrase = async (phrase) => {
    try {
      await apiFetch(`/system/speedphrases/${encodeURIComponent(phrase)}`, {
        method: "DELETE",
      });
      setSpeedPhrases(speedPhrases.filter((p) => p.phrase !== phrase));
    } catch (err) {
      setSettingsMessage({ type: "error", text: "Suppression impossible." });
    }
  };

  const handleLogout = () => {
    window.location.replace("/");
  };

  const filteredGuilds = useMemo(
    () =>
      guilds.filter((g) =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [guilds, searchQuery],
  );

  const showSearch = guilds.length > 6;
  const formatMembers = (n) =>
    typeof n === "number" ? numberFr.format(n) : "—";

  const inviteUrl = (guildId = "") =>
    `https://discord.com/api/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands${
      guildId ? `&guild_id=${guildId}&disable_guild_select=true` : ""
    }`;

  const toggleLang = () => {
    const newLang = i18n.language === "fr" ? "en" : "fr";
    i18n.changeLanguage(newLang);
    localStorage.setItem("dashboard_lang", newLang);
  };

  // Header
  const Header = () => (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-10">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500 mb-2">
          Serveurs
        </p>
        <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight text-white leading-none">
          {botName}
        </h1>
      </div>

      <nav className="flex items-center gap-1.5" aria-label="Actions">
        <button
          onClick={toggleLang}
          className="h-9 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60"
          aria-label="Changer la langue"
        >
          <Globe size={13} aria-hidden="true" />
          {i18n.language.toUpperCase()}
        </button>

        {isGlobalOwner && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="h-9 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60"
            aria-label={t("sidebar.settings")}
          >
            <Settings size={13} aria-hidden="true" />
            {t("sidebar.settings")}
          </button>
        )}

        <button
          onClick={handleLogout}
          className="h-9 px-3 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04] inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]/60"
          aria-label={t("dashboard.logout")}
        >
          <LogOut size={13} aria-hidden="true" />
          {t("dashboard.logout")}
        </button>
      </nav>
    </header>
  );

  // Skeleton (geometry mirrors GuildCard exactly)
  const SkeletonCard = () => (
    <div className="rounded-2xl bg-neutral-900 ring-1 ring-white/5 p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] animate-pulse" />
        <div className="flex-1 min-w-0 pt-1 space-y-2.5">
          <div className="h-4 w-2/3 rounded bg-white/[0.05] animate-pulse" />
          <div className="h-3 w-1/3 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
      <div className="mt-5 h-9 rounded-lg bg-white/[0.03] animate-pulse" />
    </div>
  );

  // Empty state
  const EmptyState = () => (
    <div className="rounded-2xl bg-neutral-900 ring-1 ring-white/5 px-6 py-14 text-center">
      <h3 className="text-base font-semibold text-white">
        Aucun serveur configuré.
      </h3>
      <p className="text-sm text-zinc-500 mt-1.5">
        Invitez {botName} pour commencer.
      </p>
      <a
        href={inviteUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-medium text-white transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        style={{ backgroundColor: ACCENT }}
        aria-label="Inviter sur un serveur"
      >
        <Plus size={15} aria-hidden="true" />
        Inviter sur un serveur
      </a>
    </div>
  );

  // Error state
  const ErrorState = () => (
    <div className="rounded-2xl bg-neutral-900 ring-1 ring-white/5 px-6 py-14 text-center">
      <h3 className="text-base font-semibold text-white">
        Impossible de charger les serveurs.
      </h3>
      <button
        onClick={fetchData}
        className="mt-5 inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-medium text-white transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        style={{ backgroundColor: ACCENT }}
        aria-label={t("common.retry")}
      >
        <RefreshCw size={15} aria-hidden="true" />
        {t("common.retry")}
      </button>
    </div>
  );

  // Guild card
  const GuildCard = ({ guild }) => {
    const installed = !!guild.botInstalled;
    const members = formatMembers(
      guild.memberCount ?? guild.approximate_member_count,
    );

    const ringActive = installed
      ? "ring-1 ring-[#7c5cff]/40 hover:ring-[#7c5cff]/60"
      : "ring-1 ring-white/5 hover:ring-white/10";

    return (
      <div
        className={`group rounded-2xl bg-neutral-900 ${ringActive} p-5 flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]`}
      >
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {guild.icon ? (
              <img
                src={guild.icon}
                alt=""
                className={`w-12 h-12 rounded-xl object-cover ${
                  installed
                    ? "ring-1 ring-[#7c5cff]/50"
                    : "ring-1 ring-white/10"
                }`}
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-semibold text-zinc-300 bg-white/[0.04] ${
                  installed
                    ? "ring-1 ring-[#7c5cff]/50"
                    : "ring-1 ring-white/10"
                }`}
                aria-hidden="true"
              >
                {guild.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <h3
              className="text-[15px] font-semibold text-white truncate leading-tight"
              title={guild.name}
            >
              {guild.name}
            </h3>
            <div className="mt-1 text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="tabular-nums text-zinc-400">{members}</span>
              <span>membres</span>
              {guild.owner && (
                <>
                  <span
                    className="w-0.5 h-0.5 rounded-full bg-zinc-700"
                    aria-hidden="true"
                  />
                  <span>Propriétaire</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5">
          {installed ? (
            <Link
              to={`/dashboard/${guild.id}`}
              className="w-full h-9 inline-flex items-center justify-between px-3.5 rounded-lg text-[13px] font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              style={{ backgroundColor: ACCENT }}
              aria-label={`Configurer ${guild.name}`}
            >
              <span>Configurer</span>
              <ChevronRight
                size={15}
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ) : (
            <a
              href={inviteUrl(guild.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg text-[13px] font-medium text-zinc-300 bg-white/[0.03] ring-1 ring-white/5 hover:bg-white/[0.06] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]"
              aria-label={`Inviter sur ${guild.name}`}
            >
              <Plus size={14} aria-hidden="true" />
              Inviter
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-[#7c5cff]/30 selection:text-white flex flex-col">
      <a href="#dashboard-main" className="skip-to-content">
        Aller au contenu principal
      </a>
      <div
        id="dashboard-main"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex-1 w-full"
      >
        <Header />

        {showSearch && !loading && !error && (
          <div className="relative mb-6 max-w-sm">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
              size={15}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-neutral-900 ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg pl-9 pr-3 text-[13px] text-white placeholder:text-zinc-500 transition-shadow focus:outline-none"
              aria-label={t("common.search")}
            />
          </div>
        )}

        {loading ? (
          <div
            role="status"
            aria-busy="true"
            aria-live="polite"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
            <span className="sr-only">Chargement des serveurs.</span>
          </div>
        ) : error ? (
          <ErrorState />
        ) : guilds.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredGuilds.map((guild) => (
                <motion.div
                  key={guild.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <GuildCard guild={guild} />
                </motion.div>
              ))}
            </div>

            {filteredGuilds.length === 0 && (
              <div className="rounded-2xl bg-neutral-900 ring-1 ring-white/5 px-6 py-10 text-center mt-6">
                <p className="text-sm text-zinc-400">
                  {t("dashboard.no_result")}{" "}
                  <span className="text-white">« {searchQuery} »</span>.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-white/5 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="tabular-nums">
            {botName} {VERSION}
          </span>
          <div className="flex items-center gap-5">
            <Link
              to="/doc"
              className="hover:text-zinc-300 transition-colors focus:outline-none focus-visible:text-white"
            >
              {t("dashboard.doc")}
            </Link>
            <a
              href="https://discord.gg/invite"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-300 transition-colors focus:outline-none focus-visible:text-white"
            >
              {t("dashboard.support")}
            </a>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            style={{
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            onClick={() => setIsSettingsOpen(false)}
            aria-hidden="false"
          >
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.97, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 8 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-neutral-900 ring-1 ring-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
            >
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <h2
                  id="settings-title"
                  className="text-sm font-semibold text-white"
                >
                  {t("sidebar.settings")}
                </h2>
                <button
                  ref={closeBtnRef}
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-zinc-500 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] rounded-md p-1"
                  aria-label="Fermer"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="px-5 py-5 space-y-6 overflow-y-auto flex-1 min-h-0">
                {settingsMessage.text && (
                  <div
                    role="alert"
                    className={`px-3.5 py-2.5 rounded-lg text-[12px] font-medium ring-1 ${
                      settingsMessage.type === "success"
                        ? "bg-emerald-500/[0.08] ring-emerald-500/20 text-emerald-300"
                        : "bg-red-500/[0.08] ring-red-500/20 text-red-300"
                    }`}
                  >
                    {settingsMessage.text}
                  </div>
                )}

                <section className="space-y-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.16em]">
                    <Activity size={11} aria-hidden="true" />
                    {t("dashboard.settings_modal.presence")}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="bot-status"
                        className="text-[11px] text-zinc-500 font-medium"
                      >
                        {t("dashboard.settings_modal.status")}
                      </label>
                      <select
                        id="bot-status"
                        value={botStatus}
                        onChange={(e) => setBotStatus(e.target.value)}
                        className="w-full h-9 bg-white/[0.03] ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg px-2.5 text-[13px] text-white focus:outline-none transition-shadow"
                      >
                        <option value="online">{t("dashboard.settings_modal.online")}</option>
                        <option value="idle">{t("dashboard.settings_modal.idle")}</option>
                        <option value="dnd">{t("dashboard.settings_modal.dnd")}</option>
                        <option value="invisible">{t("dashboard.settings_modal.invisible")}</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="bot-activity-type"
                        className="text-[11px] text-zinc-500 font-medium"
                      >
                        {t("dashboard.settings_modal.activity_type")}
                      </label>
                      <select
                        id="bot-activity-type"
                        value={botActivityType}
                        onChange={(e) => setBotActivityType(e.target.value)}
                        className="w-full h-9 bg-white/[0.03] ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg px-2.5 text-[13px] text-white focus:outline-none transition-shadow"
                      >
                        <option value="0">{t("dashboard.settings_modal.playing")}</option>
                        <option value="2">{t("dashboard.settings_modal.listening")}</option>
                        <option value="3">{t("dashboard.settings_modal.watching")}</option>
                        <option value="5">{t("dashboard.settings_modal.competing")}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="bot-activity-name"
                      className="text-[11px] text-zinc-500 font-medium"
                    >
                      {t("dashboard.settings_modal.activity_text")}
                    </label>
                    <input
                      id="bot-activity-name"
                      type="text"
                      placeholder="avec vos serveurs"
                      value={botActivityName}
                      onChange={(e) => setBotActivityName(e.target.value)}
                      className="w-full h-9 bg-white/[0.03] ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg px-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none transition-shadow"
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.16em]">
                    <User size={11} aria-hidden="true" />
                    {t("dashboard.settings_modal.profile")}
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="bot-username"
                      className="text-[11px] text-zinc-500 font-medium"
                    >
                      {t("dashboard.settings_modal.new_nick")}
                    </label>
                    <input
                      id="bot-username"
                      type="text"
                      placeholder="Aegis"
                      value={botUsername}
                      onChange={(e) => setBotUsername(e.target.value)}
                      className="w-full h-9 bg-white/[0.03] ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg px-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none transition-shadow"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="bot-avatar"
                      className="text-[11px] text-zinc-500 font-medium"
                    >
                      {t("dashboard.settings_modal.new_avatar")}
                    </label>
                    <input
                      id="bot-avatar"
                      type="text"
                      placeholder="https://"
                      value={botAvatar}
                      onChange={(e) => setBotAvatar(e.target.value)}
                      className="w-full h-9 bg-white/[0.03] ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg px-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:outline-none transition-shadow"
                    />
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.16em]">
                    {t("dashboard.settings_modal.speed_phrases")}
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {speedPhrases.length === 0 && (
                      <p className="text-[12px] text-zinc-600">
                        {t("dashboard.settings_modal.no_speed_phrases")}
                      </p>
                    )}
                    {speedPhrases.map((sp, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-white/[0.02] ring-1 ring-white/5 px-3 h-9 rounded-lg"
                      >
                        <span className="text-[12px] font-medium text-zinc-200 truncate">
                          {sp.name}
                        </span>
                        <button
                          onClick={() => handleDeleteSpeedPhrase(sp.phrase)}
                          className="text-zinc-500 hover:text-red-300 hover:bg-red-500/10 p-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                          aria-label={`${t("common.delete")} ${sp.name}`}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-3 border-t border-white/5">
                    <div className="flex-1 space-y-1 min-w-0">
                      <label
                        htmlFor="new-phrase"
                        className="text-[11px] text-zinc-500 font-medium"
                      >
                        {t("dashboard.settings_modal.new_phrase")}
                      </label>
                      <input
                        id="new-phrase"
                        type="text"
                        value={newPhrase}
                        onChange={(e) => setNewPhrase(e.target.value)}
                        className="w-full h-9 bg-white/[0.03] ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg px-2.5 text-[13px] text-white focus:outline-none transition-shadow"
                      />
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <label
                        htmlFor="new-phrase-name"
                        className="text-[11px] text-zinc-500 font-medium"
                      >
                        Étiquette
                      </label>
                      <input
                        id="new-phrase-name"
                        type="text"
                        value={newPhraseName}
                        onChange={(e) => setNewPhraseName(e.target.value)}
                        className="w-full h-9 bg-white/[0.03] ring-1 ring-white/5 focus:ring-[#7c5cff]/60 rounded-lg px-2.5 text-[13px] text-white focus:outline-none transition-shadow"
                      />
                    </div>
                    <button
                      onClick={handleAddSpeedPhrase}
                      className="h-9 w-full sm:w-9 rounded-lg flex items-center justify-center shrink-0 text-white transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]"
                      style={{ backgroundColor: ACCENT }}
                      aria-label={t("common.add")}
                    >
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  </div>
                </section>
              </div>

              <div className="px-5 py-3.5 border-t border-white/5 flex justify-end gap-2">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="h-9 px-3.5 text-[13px] font-medium text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-lg"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="h-9 px-4 rounded-lg text-[13px] font-medium text-white disabled:opacity-50 transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0 inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                  style={{ backgroundColor: ACCENT }}
                  aria-label={t("common.save")}
                >
                  {savingSettings ? (
                    <RefreshCw
                      size={13}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save size={13} aria-hidden="true" />
                  )}
                  {t("common.save")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
