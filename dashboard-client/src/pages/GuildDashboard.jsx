import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../api";
import { motion, AnimatePresence } from "framer-motion";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  ChevronLeft,
  Settings,
  Shield,
  Coins,
  Music,
  Smile,
  Ticket,
  TrendingUp,
  FileText,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Save,
  Hash,
  Terminal,
  MessageSquare,
  BarChart3,
  Users,
  Activity,
  Megaphone,
  UserPlus,
  Crown,
  History,
  Zap,
  ArrowUpRight,
  LayoutDashboard,
  Sliders,
  Trash2,
  Plus,
  Lock,
  Globe,
  Bell,
  X,
  Edit2,
  Search,
  RefreshCw,
  Gift,
  Send,
  ShieldCheck,
  User,
  Trash,
  Ghost,
  Pin,
  Menu,
} from "lucide-react";

// Reusable accent-styled switch — accent-on, neutral-off, 120ms slide
const Switch = ({ checked, onChange, label, id, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    id={id}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-[120ms] ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:opacity-40 disabled:cursor-not-allowed ${checked ? "bg-accent-500" : "bg-neutral-700"}`}
  >
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-soft ring-0 transition-transform duration-[120ms] ease-out ${checked ? "translate-x-5" : "translate-x-0.5"} mt-0.5`}
    />
  </button>
);

// Skeleton placeholder
const Skeleton = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-neutral-900/60 ${className}`} />
);

// Module labels and section subtitles — sourced from i18n; see translateModuleLabel + subtitleFor
const MODULE_KEYS = [
  "antiraid",
  "moderation",
  "levels",
  "economy",
  "logs",
  "welcome",
  "tickets",
  "vocal_stats",
  "casino",
  "joinping",
  "fun",
  "music",
];

const GuildDashboard = () => {
  const { t } = useTranslation();
  const { guildId } = useParams();

  // i18n helpers — resolve module label or fall back to a humanised key
  const moduleLabel = useCallback(
    (name) => {
      if (!name) return "";
      const key = `guild.module_labels.${name}`;
      const translated = t(key);
      if (translated && translated !== key) return translated;
      return name.replace("_", " ");
    },
    [t],
  );
  const sectionSubtitle = useCallback(
    (name) => {
      if (!name) return "";
      const key = `guild.section_subtitles.${name}`;
      const translated = t(key);
      if (translated && translated !== key) return translated;
      return "";
    },
    [t],
  );

  const moduleIcons = {
    moderation: Shield,
    vocal_stats: BarChart3,
    economy: Coins,
    casino: Gift,
    music: Music,
    fun: Smile,
    tickets: Ticket,
    levels: TrendingUp,
    logs: FileText,
    antiraid: ShieldAlert,
    welcome: UserPlus,
    joinping: Bell,
  };
  const [modules, setModules] = useState([]);
  const [settings, setSettings] = useState({});
  const [savedSettings, setSavedSettings] = useState({});
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [activeTab, setActiveTab] = useState("stats");
  const [activeModuleConfig, setActiveModuleConfig] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Ticket State
  const [ticketConfig, setTicketConfig] = useState({
    categoryId: "",
    roleId: "",
    logsChannelId: "",
  });
  const [ticketOptions, setTicketOptions] = useState([]);

  // Permissions State
  const [permissions, setPermissions] = useState([]);
  const [availableCommands, setAvailableCommands] = useState([]);
  const [permSearch, setPermSearch] = useState("");
  const [deployingTicket, setDeployingTicket] = useState(false);
  const [editingOption, setEditingOption] = useState(null);

  // Economy State
  const [economyUsers, setEconomyUsers] = useState([]);
  const [editingEconomy, setEditingEconomy] = useState(null);
  const [economySearch, setEconomySearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [searchingEconomy, setSearchingEconomy] = useState(false);
  const [economySearchResults, setEconomySearchResults] = useState([]);

  // Leveling State
  const [levelUsers, setLevelUsers] = useState([]);
  const [levelRoles, setLevelRoles] = useState([]);
  const [editingLevelUser, setEditingLevelUser] = useState(null);
  const [editingLevelRole, setEditingLevelRole] = useState(null);

  // Owners State
  const [isGlobalOwner, setIsGlobalOwner] = useState(false);
  const [botOwners, setBotOwners] = useState([]);
  const [newOwnerId, setNewOwnerId] = useState("");

  const [logSetup, setLogSetup] = useState({
    categoryName: "",
    mod: "",
    raid: "",
    msg: "",
    voice: "",
  });

  // Economy Settings
  const [economySettings, setEconomySettings] = useState({
    currencyName: "Coins",
    currencyEmoji: "",
    minWork: 50,
    maxWork: 200,
    minDaily: 200,
    maxDaily: 1000,
    dropChannels: [],
  });

  // Bot Console
  const [consoleLogs, setConsoleLogs] = useState([]);

  // Casino State
  const [casinoConfig, setCasinoConfig] = useState({
    rewards: [],
    settings: {},
  });
  const [deployChannel, setDeployChannel] = useState("");

  // Vocal Stats State
  const [vocalStatsConfig, setVocalStatsConfig] = useState({
    config: {},
    format: "・{emoji}・{name} :",
    membersFormat: "",
    onlineFormat: "",
    vocalFormat: "",
    topFormat: "",
    inviteFormat: "",
  });
  const [deployingStats, setDeployingStats] = useState(false);
  const [statsInviteCode, setStatsInviteCode] = useState("");

  // Audit & Security State
  const [auditLogs, setAuditLogs] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);

  // Giveaways State
  const [giveaways, setGiveaways] = useState([]);
  const [newGiveaway, setNewGiveaway] = useState({
    prize: "",
    winnersCount: 1,
    duration: 60,
    channelId: "",
    requirements: [],
  });
  const [badwords, setBadwords] = useState([]);
  const [newBadword, setNewBadword] = useState("");

  // Antiraid Whitelist
  const [antiraidWhitelist, setAntiraidWhitelist] = useState([]);
  const [newWlUserId, setNewWlUserId] = useState("");
  const [newWlBypasses, setNewWlBypasses] = useState(["*"]);

  // Confirm/prompt modal (replaces native window.confirm / window.prompt)
  const [modalState, setModalState] = useState(null);
  const modalResolveRef = useRef(null);

  // confirmDialog(question, { variant: "danger" | "primary", description })
  const confirmDialog = useCallback(
    (question, options = {}) =>
      new Promise((resolve) => {
        modalResolveRef.current = resolve;
        setModalState({
          type: "confirm",
          question,
          description: options.description || null,
          variant: options.variant || "primary",
        });
      }),
    [],
  );

  const promptDialog = useCallback(
    (question, defaultValue = "", options = {}) =>
      new Promise((resolve) => {
        modalResolveRef.current = resolve;
        setModalState({
          type: "prompt",
          question,
          description: options.description || null,
          value: defaultValue,
          placeholder: options.placeholder || "",
        });
      }),
    [],
  );

  const closeModal = useCallback((value) => {
    const resolver = modalResolveRef.current;
    modalResolveRef.current = null;
    setModalState(null);
    if (resolver) resolver(value);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mR, sR, cR, stR, rR, tR, pR] = await Promise.all([
        apiFetch(`/guilds/${guildId}/modules`),
        apiFetch(`/guilds/${guildId}/settings`),
        apiFetch(`/guilds/${guildId}/channels`),
        apiFetch(`/guilds/${guildId}/stats`),
        apiFetch(`/guilds/${guildId}/roles`),
        apiFetch(`/guilds/${guildId}/tickets`),
        apiFetch(`/guilds/${guildId}/permissions`),
      ]);

      if (!mR.ok || !sR.ok || !cR.ok || !stR.ok || !rR.ok || !tR.ok || !pR.ok)
        throw new Error(t("notifications.sync_failed"));

      const [mD, sD, cD, stD, rD, tD, pD, ecoD, lvlD, authR] =
        await Promise.all([
          mR.json(),
          sR.json(),
          cR.json(),
          stR.json(),
          rR.json(),
          tR.json(),
          pR.json(),
          apiFetch(`/guilds/${guildId}/economy`)
            .then((r) => r.json())
            .catch(() => []),
          apiFetch(`/guilds/${guildId}/levels`)
            .then((r) => r.json())
            .catch(() => ({ users: [], roles: [] })),
          apiFetch("/auth/me").catch(() => ({ ok: false })),
        ]);

      if (authR.ok) {
        const authD = await authR.json();
        setIsGlobalOwner(
          authD.isGlobalOwner || authD.roles?.includes("GLOBAL_OWNER"),
        );
      }

      // Fetch Economy Settings
      const ecoSetR = await apiFetch(`/guilds/${guildId}/economy/settings`);
      if (ecoSetR.ok) setEconomySettings(await ecoSetR.json());

      // Fetch Casino Data
      const casinoRes = await apiFetch(`/guilds/${guildId}/casino/settings`);
      if (casinoRes.ok) {
        const cData = await casinoRes.json();
        setCasinoConfig(cData.casinoConfig || { rewards: [], settings: {} });
      }

      // Fetch Vocal Stats
      const statsConfigRes = await apiFetch(
        `/guilds/${guildId}/stats-channels`,
      );
      if (statsConfigRes.ok) setVocalStatsConfig(await statsConfigRes.json());

      // Fetch Antiraid Whitelist
      const wlRes = await apiFetch(`/guilds/${guildId}/antiraid/whitelist`);
      if (wlRes.ok) setAntiraidWhitelist(await wlRes.json());

      const badwordsRes = await apiFetch(`/guilds/${guildId}/badwords`);
      if (badwordsRes.ok) setBadwords(await badwordsRes.json());

      try {
        const ownerRes = await apiFetch("/bot/owners");
        if (ownerRes.ok) {
          const oData = await ownerRes.json();
          setBotOwners(oData);
          setIsGlobalOwner(true);
        }
      } catch {
        /* owner check non-blocking */
      }

      // Fetch Giveaways
      const giveawayRes = await apiFetch(`/guilds/${guildId}/giveaways`);
      if (giveawayRes.ok) setGiveaways(await giveawayRes.json());

      // Fetch Audit Logs
      const auditRes = await apiFetch(`/guilds/${guildId}/audit-logs`);
      if (auditRes.ok) setAuditLogs(await auditRes.json());

      // Fetch Security Logs (Global Owner Only)
      if (isGlobalOwner) {
        const securityRes = await apiFetch("/bot/security-logs");
        if (securityRes.ok) setSecurityLogs(await securityRes.json());
      }

      setModules(mD);
      setSettings(sD);
      setSavedSettings(sD);
      setChannels(cD);
      setStats(stD);
      setRoles(rD);
      setTicketConfig(tD.config);
      setTicketOptions(tD.options);
      setPermissions(pD.permissions);
      setAvailableCommands(pD.availableCommands);
      setEconomyUsers(ecoD || []);
      setLevelUsers(lvlD.users || []);
      setLevelRoles(lvlD.roles || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [guildId, t, isGlobalOwner]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await apiFetch("/bot/logs");
      if (res.ok) {
        const data = await res.json();
        setConsoleLogs(data.logs);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    let interval;
    if (activeTab === "stats") {
      fetchLogs();
      interval = setInterval(fetchLogs, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab, fetchLogs]);

  const toggleModule = useCallback(
    async (name, current) => {
      const next = !current;
      setModules((prev) =>
        prev.map((m) => (m.name === name ? { ...m, isEnabled: next } : m)),
      );
      try {
        const res = await apiFetch(`/guilds/${guildId}/modules/${name}`, {
          method: "PATCH",
          body: JSON.stringify({ isEnabled: next }),
        });
        if (!res.ok) throw new Error();
        showSuccess(t("notifications.module_updated"));
      } catch {
        setModules((prev) =>
          prev.map((m) => (m.name === name ? { ...m, isEnabled: current } : m)),
        );
        showError(t("common.error"));
      }
    },
    [guildId, t],
  );

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/settings`, {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      setSavedSettings(settings);
      showSuccess(t("notifications.settings_saved"));
      setSaveFlash(true);
      setTimeout(() => setSaveFlash(false), 800);
    } catch {
      showError(t("notifications.error_save"));
    } finally {
      setSaving(false);
    }
  }, [guildId, settings, t]);

  // Dirty tracking — shallow compare of top-level keys
  const isDirty = useMemo(() => {
    const keys = new Set([
      ...Object.keys(settings || {}),
      ...Object.keys(savedSettings || {}),
    ]);
    for (const k of keys) {
      const a = settings?.[k];
      const b = savedSettings?.[k];
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length || a.some((v, i) => v !== b[i])) return true;
      } else if (a !== b) return true;
    }
    return false;
  }, [settings, savedSettings]);

  const saveTickets = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/tickets`, {
        method: "PATCH",
        body: JSON.stringify(ticketConfig),
      });
      if (!res.ok) throw new Error();
      showSuccess(t("notifications.settings_saved"));
    } catch {
      showError(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionChange = async (
    roleId,
    commandName,
    currentEnabled,
  ) => {
    try {
      const action = currentEnabled ? "remove" : "add";
      const res = await apiFetch(`/guilds/${guildId}/permissions`, {
        method: "POST",
        body: JSON.stringify({ roleId, commandName, action }),
      });
      if (!res.ok) throw new Error();

      setPermissions((prev) => {
        if (action === "add") return [...prev, { roleId, commandName }];
        return prev.filter(
          (p) => !(p.roleId === roleId && p.commandName === commandName),
        );
      });
      showSuccess(t("notifications.perm_updated"));
    } catch {
      showError(t("common.error"));
    }
  };

  const addTicketOption = async () => {
    setEditingOption({
      title: "",
      emoji: "",
      description: t("guild.tickets.panel_desc"),
      roleId: null,
    });
  };

  const saveTicketOption = async () => {
    if (!editingOption.title) return showError(t("common.error"));
    setSaving(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/tickets/options`, {
        method: "POST",
        body: JSON.stringify(editingOption),
      });
      if (!res.ok) throw new Error();
      fetchData();
      setEditingOption(null);
      showSuccess(t("notifications.option_saved"));
    } catch {
      showError(t("notifications.error_save"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTicketOption = async (id) => {
    if (
      !(await confirmDialog(t("guild.ui.delete_ticket_option"), {
        variant: "danger",
      }))
    )
      return;
    try {
      const res = await apiFetch(`/guilds/${guildId}/tickets/options/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setTicketOptions((prev) => prev.filter((o) => o.id !== id));
      showSuccess(t("notifications.option_deleted"));
    } catch {
      showError(t("common.error"));
    }
  };

  const deployTicketPanel = async () => {
    const channelId = await promptDialog(
      t("guild.ui.deploy_panel_question"),
      ticketConfig.logsChannelId || "",
      {
        description: t("guild.ui.deploy_panel_desc"),
        placeholder: t("guild.ui.channel_id_placeholder"),
      },
    );
    if (!channelId) return;

    setDeployingTicket(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/tickets/deploy`, {
        method: "POST",
        body: JSON.stringify({ channelId }),
      });
      if (res.ok) showSuccess(t("notifications.deploy_success"));
      else throw new Error();
    } catch (err) {
      showError(t("common.error"));
    } finally {
      setDeployingTicket(false);
    }
  };

  const updateEconomy = async () => {
    if (!editingEconomy || !editingEconomy.userId) return;
    if (
      editingEconomy.action !== "reset" &&
      (isNaN(editingEconomy.amount) || editingEconomy.amount === "")
    )
      return showError(t("common.error"));

    setSaving(true);
    try {
      const res = await apiFetch(
        `/guilds/${guildId}/economy/${editingEconomy.userId}`,
        {
          method: "POST",
          body: JSON.stringify({
            action: editingEconomy.action,
            amount:
              editingEconomy.action === "reset"
                ? 0
                : parseInt(editingEconomy.amount),
            walletType: editingEconomy.walletType,
          }),
        },
      );
      if (!res.ok) throw new Error();

      // Refresh economy data locally
      const ecoD = await apiFetch(`/guilds/${guildId}/economy`).then((r) =>
        r.json(),
      );
      setEconomyUsers(ecoD || []);

      showSuccess(t("notifications.balances_updated"));
      setEditingEconomy(null);
      setMemberSearch("");
      setMemberSearchResults([]);
    } catch {
      showError(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const updateLevelXP = async () => {
    if (
      !editingLevelUser ||
      !editingLevelUser.userId ||
      isNaN(editingLevelUser.amount)
    )
      return showError(t("common.error"));
    setSaving(true);
    try {
      const res = await apiFetch(
        `/guilds/${guildId}/levels/${editingLevelUser.userId}`,
        {
          method: "POST",
          body: JSON.stringify({
            action: editingLevelUser.action,
            amount: parseInt(editingLevelUser.amount),
          }),
        },
      );
      if (!res.ok) throw new Error();

      // Refresh levels locally
      const lvlD = await apiFetch(`/guilds/${guildId}/levels`).then((r) =>
        r.json(),
      );
      setLevelUsers(lvlD.users || []);

      showSuccess(t("notifications.xp_updated"));
      setEditingLevelUser(null);
      setMemberSearch(""); // Clear search if used
      setMemberSearchResults([]);
    } catch {
      showError(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const saveLevelRole = async () => {
    if (
      !editingLevelRole ||
      !editingLevelRole.level ||
      !editingLevelRole.roleId
    )
      return showError(t("common.error"));
    setSaving(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/levels/roles`, {
        method: "POST",
        body: JSON.stringify(editingLevelRole),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("common.error"));
      }

      const lvlD = await apiFetch(`/guilds/${guildId}/levels`).then((r) =>
        r.json(),
      );
      setLevelRoles(lvlD.roles || []);

      showSuccess(t("notifications.role_saved"));
      setEditingLevelRole(null);
    } catch (e) {
      showError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteLevelRole = async (id) => {
    if (
      !(await confirmDialog(t("guild.ui.delete_level_reward"), {
        variant: "danger",
      }))
    )
      return;
    try {
      const res = await apiFetch(`/guilds/${guildId}/levels/roles/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setLevelRoles((prev) => prev.filter((r) => r.id !== id));
      showSuccess(t("notifications.reward_deleted"));
    } catch {
      showError(t("common.error"));
    }
  };

  const addBotOwner = async () => {
    if (!newOwnerId) return showError(t("common.error"));
    setSaving(true);
    try {
      const res = await apiFetch(`/bot/owners`, {
        method: "POST",
        body: JSON.stringify({ userId: newOwnerId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setBotOwners((prev) => [
        ...prev,
        {
          userId: newOwnerId,
          addedAt: Date.now(),
          username: data.username,
          avatar: data.avatar,
        },
      ]);
      setNewOwnerId("");
      showSuccess(t("notifications.owner_added"));
    } catch (e) {
      showError(e.message || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const removeBotOwner = async (userId) => {
    if (
      !(await confirmDialog(t("guild.ui.revoke_owner"), {
        variant: "danger",
      }))
    )
      return;
    try {
      const res = await apiFetch(`/bot/owners/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setBotOwners((prev) => prev.filter((o) => o.userId !== userId));
      showSuccess(t("notifications.access_revoked"));
    } catch {
      showError(t("common.error"));
    }
  };

  const setupLogs = async () => {
    if (
      !(await confirmDialog(t("guild.ui.setup_logs_question"), {
        description: t("guild.ui.setup_logs_desc"),
      }))
    )
      return;
    setSaving(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/logs/setup`, {
        method: "POST",
        body: JSON.stringify({
          categoryName: logSetup.categoryName,
          channels: {
            mod: logSetup.mod,
            raid: logSetup.raid,
            msg: logSetup.msg,
            voice: logSetup.voice,
          },
        }),
      });
      if (!res.ok) throw new Error();
      const { updates } = await res.json();
      setSettings((prev) => ({ ...prev, ...updates }));
      showSuccess(t("notifications.logs_created"));
      fetchData(); // reload channels
    } catch {
      showError(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const searchMembers = async () => {
      if (memberSearch.length < 2) {
        setMemberSearchResults([]);
        return;
      }
      setSearchingMembers(true);
      try {
        const res = await apiFetch(
          `/guilds/${guildId}/members/search?q=${encodeURIComponent(memberSearch)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setMemberSearchResults(data || []);
        }
      } catch {
        // silently fail member search — UI shows empty state
      } finally {
        setSearchingMembers(false);
      }
    };

    const debounce = setTimeout(searchMembers, 500);
    return () => clearTimeout(debounce);
  }, [memberSearch, guildId]);

  useEffect(() => {
    const searchEconomy = async () => {
      if (economySearch.length < 2) {
        setEconomySearchResults([]);
        return;
      }
      setSearchingEconomy(true);
      try {
        const res = await apiFetch(
          `/guilds/${guildId}/members/search?q=${encodeURIComponent(economySearch)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setEconomySearchResults(data || []);
        }
      } catch {
        // silently fail economy member search
      } finally {
        setSearchingEconomy(false);
      }
    };

    const debounce = setTimeout(searchEconomy, 500);
    return () => clearTimeout(debounce);
  }, [economySearch, guildId]);

  const saveEconomySettings = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/economy/settings`, {
        method: "PATCH",
        body: JSON.stringify(economySettings),
      });
      if (res.ok) showSuccess(t("notifications.eco_saved"));
      else throw new Error();
    } catch {
      showError(t("notifications.error_save"));
    } finally {
      setSaving(false);
    }
  };

  const saveVocalStats = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/stats-channels`, {
        method: "PATCH",
        body: JSON.stringify(vocalStatsConfig),
      });
      if (res.ok) showSuccess(t("notifications.vocal_saved"));
      else throw new Error();
    } catch {
      showError(t("notifications.error_save"));
    } finally {
      setSaving(false);
    }
  };

  const deployVocalStats = async () => {
    setDeployingStats(true);
    try {
      const res = await apiFetch(`/guilds/${guildId}/stats-channels/setup`, {
        method: "POST",
        body: JSON.stringify({ inviteCode: statsInviteCode }),
      });
      if (res.ok) {
        showSuccess(t("notifications.stats_deployed"));
        fetchData();
      } else throw new Error();
    } catch {
      showError(t("common.error"));
    } finally {
      setDeployingStats(false);
    }
  };

  const handleAddWlUser = async () => {
    if (!newWlUserId) return;
    try {
      const res = await apiFetch(`/guilds/${guildId}/antiraid/whitelist`, {
        method: "POST",
        body: JSON.stringify({ userId: newWlUserId, bypasses: newWlBypasses }),
      });
      if (res.ok) {
        showSuccess(t("notifications.wl_added"));
        setNewWlUserId("");
        fetchData();
      } else throw new Error();
    } catch {
      showError(t("common.error"));
    }
  };

  const handleRemoveWlUser = async (userId) => {
    try {
      const res = await apiFetch(
        `/guilds/${guildId}/antiraid/whitelist/${userId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        showSuccess(t("notifications.wl_removed"));
        fetchData();
      } else throw new Error();
    } catch {
      showError(t("common.error"));
    }
  };

  const handleToggleWlBypass = async (userId, bypass, currentBypasses) => {
    let newBypasses = [...currentBypasses];
    if (bypass === "*") {
      newBypasses = newBypasses.includes("*") ? [] : ["*"];
    } else {
      if (newBypasses.includes("*"))
        newBypasses = newBypasses.filter((b) => b !== "*");
      if (newBypasses.includes(bypass))
        newBypasses = newBypasses.filter((b) => b !== bypass);
      else newBypasses.push(bypass);
    }
    try {
      await apiFetch(`/guilds/${guildId}/antiraid/whitelist`, {
        method: "POST",
        body: JSON.stringify({ userId, bypasses: newBypasses }),
      });
      fetchData();
      showSuccess(t("notifications.wl_updated"));
    } catch {
      showError(t("common.error"));
    }
  };

  const addBadword = async () => {
    const word = newBadword.trim();
    if (!word) return;
    try {
      const res = await apiFetch(`/guilds/${guildId}/badwords`, {
        method: "POST",
        body: JSON.stringify({ word }),
      });
      if (!res.ok) throw new Error();
      setBadwords((prev) =>
        prev.includes(word.toLowerCase())
          ? prev
          : [...prev, word.toLowerCase()].sort(),
      );
      setNewBadword("");
      showSuccess(t("notifications.settings_saved"));
    } catch {
      showError(t("common.error"));
    }
  };

  const deleteBadword = async (word) => {
    try {
      const res = await apiFetch(
        `/guilds/${guildId}/badwords/${encodeURIComponent(word)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      setBadwords((prev) => prev.filter((item) => item !== word));
      showSuccess(t("notifications.settings_saved"));
    } catch {
      showError(t("common.error"));
    }
  };

  // Toast copy normalisation — strip filler ("avec succès", trailing !), keep terse
  const cleanToast = (msg) => {
    if (!msg) return msg;
    return String(msg)
      .replace(/\s*avec succès/gi, "")
      .replace(/!+\s*$/g, ".")
      .replace(/\s+\./g, ".")
      .trim();
  };
  const showSuccess = (msg) => {
    setSuccessMsg(cleanToast(msg) || t("guild.ui.settings_saved"));
    setTimeout(() => setSuccessMsg(null), 3000);
  };
  const showError = (msg, reqId) => {
    // Append the correlation ID so users can quote it when filing a bug.
    // reqId is best-effort: it may come from the JSON body OR the
    // X-Request-Id header surfaced by apiFetch.
    const base = cleanToast(msg) || t("guild.ui.save_error");
    setError(reqId ? `${base} [ID: ${reqId}]` : base);
    setTimeout(() => setError(null), 5000);
  };

  if (loading)
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex font-sans">
        <aside
          className="hidden md:flex w-72 bg-neutral-950 ring-1 ring-white/5 flex-col p-5 gap-2"
          aria-hidden="true"
        >
          <Skeleton className="h-9 w-40 mb-4" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </aside>
        <main className="flex-1 p-6 lg:p-10 space-y-6">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-48" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
          <span className="sr-only">{t("guild.ui.loading")}</span>
        </main>
      </div>
    );

  const textChannels = channels.filter((c) => c.type === 0);
  const categories = channels.filter((c) => c.type === 4);

  // Active section title + subtitle (used by main header)
  const sectionMeta = {
    stats: {
      title: t("guild.sections.stats_title"),
      sub: t("guild.sections.stats_sub"),
    },
    modules: {
      title: t("guild.sections.modules_title"),
      sub: t("guild.sections.modules_sub"),
    },
    giveaways: {
      title: t("guild.sections.giveaways_title"),
      sub: t("guild.sections.giveaways_sub"),
    },
    audit: {
      title: t("guild.sections.audit_title"),
      sub: t("guild.sections.audit_sub"),
    },
    security: {
      title: t("guild.sections.security_title"),
      sub: t("guild.sections.security_sub"),
    },
    owners: {
      title: t("guild.sections.owners_title"),
      sub: t("guild.sections.owners_sub"),
    },
  };

  const navItem = (key, Icon, label) => {
    const isActive = activeTab === key && !activeModuleConfig;
    return (
      <button
        key={key}
        onClick={() => {
          setActiveTab(key);
          setActiveModuleConfig(null);
          setMobileNavOpen(false);
        }}
        aria-current={isActive ? "page" : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 ring-0 ${
          isActive
            ? "ring-1 ring-accent-500/30 bg-accent-500/10 text-white"
            : "text-neutral-400 hover:bg-white/5 hover:text-white"
        }`}
      >
        <Icon
          size={16}
          className={`shrink-0 ${isActive ? "text-accent-300" : ""}`}
        />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const moduleNavItem = (m) => {
    const Icon = moduleIcons[m.name] || Settings;
    const isActive = activeModuleConfig === m.name;
    return (
      <button
        key={m.name}
        onClick={() => {
          setActiveTab("modules");
          setActiveModuleConfig(m.name);
          setMobileNavOpen(false);
        }}
        aria-current={isActive ? "page" : undefined}
        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 ring-0 ${
          isActive
            ? "ring-1 ring-accent-500/30 bg-accent-500/10 text-white"
            : "text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
        }`}
      >
        <Icon
          size={14}
          className={`shrink-0 ${isActive ? "text-accent-300" : ""}`}
        />
        <span className="truncate">{moduleLabel(m.name)}</span>
        {m.isEnabled && (
          <span
            className={`ml-auto w-1.5 h-1.5 rounded-full ${isActive ? "bg-accent-300" : "bg-emerald-400"}`}
            aria-label={t("common.active")}
          />
        )}
      </button>
    );
  };

  const SidebarContents = (
    <>
      <div className="p-5 flex items-center justify-between">
        <Link
          to="/dashboard"
          className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 rounded-lg"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="w-9 h-9 bg-accent-500 text-white rounded-xl flex items-center justify-center font-bold shadow-soft">
            A
          </div>
          <div className="min-w-0">
            <span className="block font-semibold tracking-tight text-white text-sm leading-tight">
              Aegis
            </span>
            <span className="block text-[11px] text-neutral-500 truncate max-w-[160px]">
              {stats?.guild?.name || "…"}
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors duration-[120ms]"
          aria-label={t("guild.ui.close_menu")}
        >
          <X size={16} />
        </button>
      </div>

      <nav
        className="flex-1 px-3 space-y-0.5 overflow-y-auto custom-scrollbar pb-4"
        aria-label={t("guild.ui.navigation")}
      >
        {navItem("stats", LayoutDashboard, t("guild.sections.stats_title"))}
        {navItem("modules", Zap, t("guild.sections.modules_title"))}
        {activeTab === "modules" && modules.length > 0 && (
          <div className="mt-1 mb-2 pl-2 space-y-0.5 border-l border-white/5 ml-3">
            {modules.filter((m) => m.name !== "music").map(moduleNavItem)}
          </div>
        )}
        {navItem("giveaways", Gift, t("guild.sections.giveaways_title"))}
        {navItem("audit", History, t("guild.sections.audit_title"))}
        {isGlobalOwner &&
          navItem("security", ShieldCheck, t("guild.sections.security_title"))}
        {isGlobalOwner &&
          navItem("owners", Crown, t("guild.sections.owners_title"))}
      </nav>

      <div className="p-3 mt-auto">
        <div className="rounded-xl bg-neutral-900 ring-1 ring-white/5 shadow-soft p-3">
          <div className="flex items-center gap-3 mb-2">
            {stats?.guild?.icon ? (
              <img
                src={stats.guild.icon}
                className="w-8 h-8 rounded-md"
                alt=""
              />
            ) : (
              <div className="w-8 h-8 bg-neutral-800 rounded-md" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {stats?.guild?.name || t("guild.ui.server_fallback")}
              </p>
              <p className="text-[10px] text-neutral-500 font-mono truncate">
                {guildId.slice(0, 10)}…
              </p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="text-[11px] font-medium text-neutral-400 hover:text-white flex items-center justify-center gap-2 transition-colors duration-[120ms] w-full py-1.5 rounded-md hover:bg-white/5"
          >
            {t("guild.ui.change_server")}
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex font-sans selection:bg-accent-500 selection:text-white overflow-x-hidden">
      {/* MOBILE OVERLAY — backdrop-blur scrim */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR — dark neutral-950, mobile slide-in */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[min(85vw,18rem)] md:w-72 bg-neutral-950 ring-1 ring-white/5 flex flex-col z-50 transition-transform duration-[180ms] ease-out md:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        aria-label={t("guild.ui.main_nav")}
      >
        {SidebarContents}
      </aside>

      <a href="#guild-main" className="skip-to-content">
        Aller au contenu principal
      </a>
      {/* MAIN */}
      <main id="guild-main" className="flex-1 min-w-0 md:ml-72">
        <header className="border-b border-white/5 flex items-start sm:items-center justify-between gap-4 px-4 md:px-8 py-5 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-start gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden mt-1 p-2 rounded-lg text-neutral-300 hover:bg-white/5 transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
              aria-label={t("guild.ui.open_menu")}
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight truncate">
                {activeModuleConfig
                  ? moduleLabel(activeModuleConfig)
                  : sectionMeta[activeTab]?.title || activeTab}
              </h1>
              <p className="text-sm text-neutral-400 truncate mt-0.5">
                {activeModuleConfig
                  ? sectionSubtitle(activeModuleConfig) ||
                    t("guild.section_subtitles.default")
                  : sectionMeta[activeTab]?.sub || ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 mt-1 sm:mt-0">
            {isDirty && (
              <span
                className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 text-xs font-medium ring-1 ring-amber-500/20"
                role="status"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {t("guild.ui.unsaved_changes")}
              </span>
            )}
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono text-neutral-500">
                {stats?.guild?.ping ?? "—"} ms
              </span>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto pb-40 sm:pb-32">
          <AnimatePresence mode="wait">
            {activeTab === "stats" && (
              <motion.div
                key="stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Statistiques rapides */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: t("guild.stats.population"),
                      val: stats?.guild?.memberCount,
                      icon: Users,
                    },
                    {
                      label: t("guild.stats.alerts"),
                      val: stats?.moderationCount,
                      icon: ShieldAlert,
                    },
                    {
                      label: t("guild.stats.uptime"),
                      val: "99.9%",
                      icon: Activity,
                    },
                    {
                      label: t("guild.stats.protocols"),
                      val: `${modules.filter((m) => m.isEnabled).length}`,
                      icon: Zap,
                    },
                  ].map((k, i) => (
                    <div
                      key={i}
                      className="apex-card border-none bg-zinc-900/40 p-6"
                    >
                      <k.icon size={14} className="text-zinc-600 mb-4" />
                      <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-1">
                        {k.label}
                      </p>
                      <h4 className="text-2xl font-bold text-white">{k.val}</h4>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Graphe de trafic */}
                  <div className="lg:col-span-8 apex-card p-8 bg-zinc-900/20">
                    <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">
                      {t("guild.stats.server_activity")}
                    </h3>
                    <div className="h-[150px] w-full">
                      <ResponsiveContainer
                        key={`responsive-${activeTab}`}
                        width="100%"
                        height="100%"
                        minWidth={0}
                        minHeight={0}
                      >
                        <AreaChart data={stats?.history || []}>
                          <defs>
                            <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                              <stop
                                offset="0%"
                                stopColor="#fff"
                                stopOpacity={0.1}
                              />
                              <stop
                                offset="100%"
                                stopColor="#fff"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" hide /> <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#000",
                              border: "1px solid #222",
                              borderRadius: "4px",
                              fontSize: "10px",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="messageCount"
                            stroke="#fff"
                            strokeWidth={1}
                            fill="url(#gS)"
                            animationDuration={1000}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Paramètres Rapides (Préfixe) */}
                  <div className="lg:col-span-4 apex-card p-8 bg-zinc-900/40 border-zinc-800 space-y-6 flex flex-col justify-center">
                    <div>
                      <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
                        {t("guild.stats.quick_config")}
                      </h3>
                      <label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1.5">
                        {t("guild.stats.prefix")}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={settings.prefix || ""}
                          onChange={(e) =>
                            setSettings({ ...settings, prefix: e.target.value })
                          }
                          className="apex-input w-full text-lg font-bold"
                          maxLength={5}
                        />
                        <button
                          onClick={saveSettings}
                          disabled={saving}
                          className="apex-button-primary px-3 py-2 flex items-center justify-center"
                        >
                          {saving ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Save size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-zinc-800/50">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest">
                        <span className="text-zinc-600">
                          {t("guild.stats.bot_status")}:
                        </span>
                        <span className="text-emerald-500 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {t("common.online")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Console Logs intégrés au Dashboard */}
                <div className="apex-card p-0 overflow-hidden border-zinc-800/50 bg-black/40">
                  <div className="bg-zinc-900/30 p-4 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal size={14} className="text-zinc-500" />
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                        {t("guild.stats.console_flux")}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const res = await apiFetch("/bot/logs/full");
                          if (res.ok) {
                            const data = await res.json();
                            setConsoleLogs(data.logs.split("\n"));
                          }
                        }}
                        className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 hover:text-emerald-500 transition-colors flex items-center gap-1.5 border border-zinc-800 px-2 py-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
                      >
                        <History size={10} aria-hidden="true" />{" "}
                        {t("guild.stats.load_logs")}
                      </button>
                      <div className="w-2 h-2 rounded-full bg-zinc-800" />
                    </div>
                  </div>
                  <div className="p-6 h-[350px] overflow-y-auto font-mono text-[13px] space-y-1.5 custom-scrollbar bg-black/20">
                    {consoleLogs.length === 0 ? (
                      <p className="text-zinc-800 italic">
                        {t("guild.stats.connecting_flux")}
                      </p>
                    ) : (
                      consoleLogs.map((log, i) => {
                        const isError = log.includes("[ERROR]");
                        const isWarn = log.includes("[WARN]");
                        return (
                          <div
                            key={i}
                            className={`${isError ? "text-rose-400" : isWarn ? "text-amber-400" : "text-zinc-400"}`}
                          >
                            <span className="text-zinc-600 mr-2">
                              [{log.match(/\[(.*?)\]/)?.[1] || "---"}]
                            </span>
                            {log.split("]").slice(2).join("]")}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "modules" && !activeModuleConfig && (
              <motion.div
                key="modules"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {modules
                  .filter((m) => m.name !== "music")
                  .map((m) => {
                    const Icon = moduleIcons[m.name] || Settings;
                    return (
                      <div
                        key={m.name}
                        role="button"
                        tabIndex={0}
                        aria-label={`Configurer ${moduleLabel(m.name)}`}
                        onClick={(e) => {
                          if (e.target.closest(".toggle-btn")) return;
                          setActiveModuleConfig(m.name);
                        }}
                        onKeyDown={(e) => {
                          if (e.target.closest(".toggle-btn")) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setActiveModuleConfig(m.name);
                          }
                        }}
                        className={`rounded-xl bg-neutral-900 ring-1 shadow-soft p-6 cursor-pointer transition-colors duration-[120ms] group focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 ${m.isEnabled ? "ring-white/5 hover:ring-accent-500/30" : "ring-white/5 opacity-70 hover:opacity-100 hover:ring-white/10"}`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-[120ms] ${m.isEnabled ? "bg-accent-500/10 ring-1 ring-accent-500/30 text-accent-300" : "bg-neutral-800 text-neutral-500"}`}
                          >
                            <Icon size={22} />
                          </div>
                          <div
                            className="toggle-btn"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Switch
                              checked={m.isEnabled}
                              onChange={() => toggleModule(m.name, m.isEnabled)}
                              label={moduleLabel(m.name)}
                            />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold tracking-tight text-white mb-1">
                          {moduleLabel(m.name)}
                        </h3>
                        <p className="text-sm text-neutral-400">
                          {sectionSubtitle(m.name) ||
                            (m.isEnabled
                              ? t("guild.section_subtitles.active")
                              : t("guild.section_subtitles.inactive"))}
                        </p>
                      </div>
                    );
                  })}
              </motion.div>
            )}

            {activeTab === "modules" && activeModuleConfig && (
              <motion.div
                key="moduleConfig"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-10"
              >
                <button
                  onClick={() => setActiveModuleConfig(null)}
                  className="apex-button-secondary text-xs flex items-center gap-2 mb-6"
                >
                  <ChevronLeft size={16} /> {t("guild.modules.back")}
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-8 space-y-8">
                    {activeModuleConfig === "logs" && (
                      <div className="space-y-8">
                        <div className="apex-card p-8 space-y-8">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.logs.title")}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                              { k: "modLogsChannel", l: t("guild.logs.mod") },
                              {
                                k: "raidLogsChannel",
                                l: t("guild.logs.security"),
                              },
                              { k: "msgLogsChannel", l: t("guild.logs.msg") },
                              {
                                k: "voiceLogsChannel",
                                l: t("guild.logs.voice"),
                              },
                            ].map((f) => (
                              <div key={f.k}>
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {f.l}
                                </label>
                                <select
                                  value={settings[f.k] || ""}
                                  onChange={(e) =>
                                    setSettings({
                                      ...settings,
                                      [f.k]: e.target.value || null,
                                    })
                                  }
                                  className="apex-input w-full appearance-none"
                                >
                                  <option value="">{t("common.none")}</option>
                                  {textChannels.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      # {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={saveSettings}
                            disabled={saving}
                            className="apex-button-primary w-full flex items-center justify-center gap-2"
                          >
                            {saving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}{" "}
                            {t("guild.logs.apply_changes")}
                          </button>
                        </div>

                        {/* Auto-Setup Logs */}
                        <div className="apex-card p-8 border-dashed border-zinc-700">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.logs.auto_setup")}
                          </h3>
                          <p className="text-[10px] text-zinc-600 font-mono mt-2 mb-6">
                            {t("guild.logs.auto_setup_desc")}
                          </p>
                          <div className="space-y-6 mb-12">
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.logs.cat_name")}
                              </label>
                              <input
                                type="text"
                                value={logSetup.categoryName}
                                onChange={(e) =>
                                  setLogSetup({
                                    ...logSetup,
                                    categoryName: e.target.value,
                                  })
                                }
                                placeholder={t("guild.logs.cat_placeholder")}
                                className="apex-input w-full"
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[
                                {
                                  k: "mod",
                                  l: t("guild.logs.mod"),
                                  color: "bg-emerald-500",
                                  p: "・mod-logs",
                                },
                                {
                                  k: "raid",
                                  l: t("guild.logs.security"),
                                  color: "bg-amber-500",
                                  p: "・raid-logs",
                                },
                                {
                                  k: "msg",
                                  l: t("guild.logs.msg"),
                                  color: "bg-blue-500",
                                  p: "・msg-logs",
                                },
                                {
                                  k: "voice",
                                  l: t("guild.logs.voice"),
                                  color: "bg-purple-500",
                                  p: "・voice-logs",
                                },
                              ].map((f) => (
                                <div key={f.k}>
                                  <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                    {t("guild.logs.channel_label")} {f.l}
                                  </label>
                                  <div className="relative">
                                    <div
                                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${f.color}`}
                                    />
                                    <input
                                      type="text"
                                      value={logSetup[f.k]}
                                      onChange={(e) =>
                                        setLogSetup({
                                          ...logSetup,
                                          [f.k]: e.target.value,
                                        })
                                      }
                                      placeholder={f.p}
                                      className="apex-input w-full pl-7 text-[11px]"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={setupLogs}
                            disabled={saving}
                            className="apex-button-secondary w-full flex items-center justify-center gap-2 border-zinc-700 hover:border-zinc-500"
                          >
                            {saving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Zap size={16} />
                            )}{" "}
                            {t("guild.logs.deploy")}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ----- SECURITY / ANTIRAID ----- */}
                    {activeModuleConfig === "antiraid" && (
                      <div className="space-y-10">
                        <div className="apex-card p-5 sm:p-10">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-6">
                            {t("guild.antiraid.title")}
                          </h3>
                          <p className="text-[11px] text-zinc-500 font-mono mt-3 mb-8 leading-relaxed">
                            {t("guild.antiraid.desc")}
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-10 max-w-6xl">
                            {[
                              {
                                k: "antiSpam",
                                l: t("guild.antiraid.protections.antiSpam_l"),
                                d: t("guild.antiraid.protections.antiSpam_d"),
                                punishmentKey: "antiSpamPunishment",
                                defaultPunishment: "mute",
                                icon: MessageSquare,
                              },
                              {
                                k: "antiLink",
                                l: t("guild.antiraid.protections.antiLink_l"),
                                d: t("guild.antiraid.protections.antiLink_d"),
                                punishmentKey: "antiLinkPunishment",
                                defaultPunishment: "delete",
                                icon: Globe,
                              },
                              {
                                k: "antiBadWords",
                                l: t("guild.antiraid.protections.antiBadWords_l"),
                                d: t("guild.antiraid.protections.antiBadWords_d"),
                                punishmentKey: "antiBadWordsPunishment",
                                defaultPunishment: "delete",
                                icon: Bell,
                              },
                              {
                                k: "antiBot",
                                l: t("guild.antiraid.protections.antiBot_l"),
                                d: t("guild.antiraid.protections.antiBot_d"),
                                punishmentKey: "antiBotPunishment",
                                defaultPunishment: "ban",
                                icon: UserPlus,
                              },
                              {
                                k: "antiMassMention",
                                l: t("guild.antiraid.protections.antiMassMention_l"),
                                d: t("guild.antiraid.protections.antiMassMention_d"),
                                punishmentKey: "antiMassMentionPunishment",
                                defaultPunishment: "mute",
                                icon: Hash,
                              },
                              {
                                k: "antiNuke",
                                l: t("guild.antiraid.protections.antiNuke_l"),
                                d: t("guild.antiraid.protections.antiNuke_d"),
                                punishmentKey: "antiNukePunishment",
                                defaultPunishment: "ban",
                                icon: ShieldAlert,
                              },
                              {
                                k: "antiEditGuild",
                                l: t("guild.antiraid.protections.antiEditGuild_l"),
                                d: t("guild.antiraid.protections.antiEditGuild_d"),
                                punishmentKey: "antiEditGuildPunishment",
                                defaultPunishment: "ban",
                                icon: Shield,
                              },
                              {
                                k: "antiNewAccount",
                                l: t("guild.antiraid.protections.antiNewAccount_l"),
                                d: t("guild.antiraid.protections.antiNewAccount_d"),
                                punishmentKey: "antiNewAccountPunishment",
                                defaultPunishment: "kick",
                                icon: UserPlus,
                              },
                              {
                                k: "antiChannel",
                                l: t("guild.antiraid.protections.antiChannel_l"),
                                d: t("guild.antiraid.protections.antiChannel_d"),
                                punishmentKey: "antiChannelPunishment",
                                defaultPunishment: "strip",
                                icon: Hash,
                              },
                              {
                                k: "antiRole",
                                l: t("guild.antiraid.protections.antiRole_l"),
                                d: t("guild.antiraid.protections.antiRole_d"),
                                punishmentKey: "antiRolePunishment",
                                defaultPunishment: "strip",
                                icon: Crown,
                              },
                              {
                                k: "antiKick",
                                l: t("guild.antiraid.protections.antiKick_l"),
                                d: t("guild.antiraid.protections.antiKick_d"),
                                punishmentKey: "antiKickPunishment",
                                defaultPunishment: "ban",
                                icon: Shield,
                              },
                              {
                                k: "antiBan",
                                l: t("guild.antiraid.protections.antiBan_l"),
                                d: t("guild.antiraid.protections.antiBan_d"),
                                punishmentKey: "antiBanPunishment",
                                defaultPunishment: "ban",
                                icon: ShieldAlert,
                              },
                              {
                                k: "antiUnban",
                                l: t("guild.antiraid.protections.antiUnban_l"),
                                d: t("guild.antiraid.protections.antiUnban_d"),
                                punishmentKey: "antiUnbanPunishment",
                                defaultPunishment: "ban",
                                icon: ShieldCheck,
                              },
                              {
                                k: "antiWebhook",
                                l: t("guild.antiraid.protections.antiWebhook_l"),
                                d: t("guild.antiraid.protections.antiWebhook_d"),
                                punishmentKey: "antiWebhookPunishment",
                                defaultPunishment: "ban",
                                icon: Globe,
                              },
                              {
                                k: "antiEmote",
                                l: t("guild.antiraid.protections.antiEmote_l"),
                                d: t("guild.antiraid.protections.antiEmote_d"),
                                punishmentKey: "antiEmotePunishment",
                                defaultPunishment: "strip",
                                icon: Smile,
                              },
                              {
                                k: "antiSticker",
                                l: t("guild.antiraid.protections.antiSticker_l"),
                                d: t("guild.antiraid.protections.antiSticker_d"),
                                punishmentKey: "antiStickerPunishment",
                                defaultPunishment: "strip",
                                icon: Pin,
                              },
                              {
                                k: "antiSoundboard",
                                l: t("guild.antiraid.protections.antiSoundboard_l"),
                                d: t("guild.antiraid.protections.antiSoundboard_d"),
                                punishmentKey: "antiSoundboardPunishment",
                                defaultPunishment: "strip",
                                icon: Music,
                              },
                              {
                                k: "antiThread",
                                l: t("guild.antiraid.protections.antiThread_l"),
                                d: t("guild.antiraid.protections.antiThread_d"),
                                punishmentKey: "antiThreadPunishment",
                                defaultPunishment: "strip",
                                icon: MessageSquare,
                              },
                              {
                                k: "antiCreateInvite",
                                l: t("guild.antiraid.protections.antiCreateInvite_l"),
                                d: t("guild.antiraid.protections.antiCreateInvite_d"),
                                punishmentKey: "antiCreateInvitePunishment",
                                defaultPunishment: "strip",
                                icon: UserPlus,
                              },
                              {
                                k: "antiRank",
                                l: t("guild.antiraid.protections.antiRank_l"),
                                d: t("guild.antiraid.protections.antiRank_d"),
                                punishmentKey: "antiRankPunishment",
                                defaultPunishment: "strip",
                                icon: TrendingUp,
                              },
                              {
                                k: "raidMode",
                                l: t("guild.antiraid.protections.raidMode_l"),
                                d: t("guild.antiraid.protections.raidMode_d"),
                                punishmentKey: "antiJoinPunishment",
                                defaultPunishment: "kick",
                                icon: Lock,
                              },
                            ].map((s) => (
                              <div
                                key={s.k}
                                className={`bento-card px-5 py-5 sm:px-10 sm:py-10 flex flex-col justify-between min-h-[160px] group/card ${settings[s.k] ? "bento-card-active" : ""}`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-4 mb-5">
                                    <div className="flex items-center gap-3">
                                      <h4
                                        className={`text-[19px] font-bold tracking-tight transition-colors ${settings[s.k] ? "text-white" : "text-zinc-400"}`}
                                      >
                                        {s.l}
                                      </h4>
                                      {settings[s.k] && (
                                        <div className="bento-badge px-3 py-1">
                                          {t("guild.antiraid.active")}
                                        </div>
                                      )}
                                    </div>
                                    <Switch
                                      checked={!!settings[s.k]}
                                      onChange={(v) =>
                                        setSettings({ ...settings, [s.k]: v })
                                      }
                                      label={s.l}
                                    />
                                  </div>
                                  <p className="text-[14px] text-zinc-500 font-medium opacity-80 leading-relaxed max-w-md">
                                    {s.d}
                                  </p>
                                </div>

                                {settings[s.k] && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-8 pt-6 border-t border-white/[0.03] flex items-center justify-between"
                                  >
                                    <span className="text-[11px] text-zinc-600 font-bold uppercase tracking-[0.1em]">
                                      {t("guild.antiraid.action")}
                                    </span>
                                    <select
                                      value={
                                        settings[s.punishmentKey] ||
                                        s.defaultPunishment
                                      }
                                      onChange={(e) =>
                                        setSettings({
                                          ...settings,
                                          [s.punishmentKey]: e.target.value,
                                        })
                                      }
                                      className="bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-white/[0.05] text-[11px] font-bold text-white focus:ring-0 cursor-pointer hover:bg-zinc-800 transition-all"
                                    >
                                      <option value="warn">
                                        {t("guild.antiraid.punishments.warn")}
                                      </option>
                                      <option value="mute">
                                        {t("guild.antiraid.punishments.mute")}
                                      </option>
                                      <option value="kick">
                                        {t("guild.antiraid.punishments.kick")}
                                      </option>
                                      <option value="ban">
                                        {t("guild.antiraid.punishments.ban")}
                                      </option>
                                      <option value="strip">
                                        {t("guild.antiraid.punishments.strip")}
                                      </option>
                                      <option value="delete">
                                        {t("guild.antiraid.punishments.delete")}
                                      </option>
                                    </select>
                                  </motion.div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Limites de Détection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {[
                            {
                              k: "nukeChannelLimit",
                              l: t("guild.antiraid.limits.channels"),
                              d: t("guild.antiraid.limits.channels_desc"),
                              default: 3,
                              icon: Hash,
                            },
                            {
                              k: "nukeRoleLimit",
                              l: t("guild.antiraid.limits.roles"),
                              d: t("guild.antiraid.limits.roles_desc"),
                              default: 3,
                              icon: Crown,
                            },
                            {
                              k: "nukeBanLimit",
                              l: t("guild.antiraid.limits.bans"),
                              d: t("guild.antiraid.limits.bans_desc"),
                              default: 3,
                              icon: ShieldAlert,
                            },
                            {
                              k: "nukeUnbanLimit",
                              l: t("guild.antiraid.limits.unbans"),
                              d: t("guild.antiraid.limits.unbans_desc"),
                              default: 3,
                              icon: ShieldCheck,
                            },
                            {
                              k: "spamLimit",
                              l: t("guild.antiraid.limits.spam"),
                              d: t("guild.antiraid.limits.spam_desc"),
                              default: 5,
                              icon: MessageSquare,
                            },
                            {
                              k: "mentionLimit",
                              l: t("guild.antiraid.limits.mentions"),
                              d: t("guild.antiraid.limits.mentions_desc"),
                              default: 5,
                              icon: Hash,
                            },
                          ].map((limit) => (
                            <div
                              key={limit.k}
                              className="glass-card p-8 border-white/5 space-y-6 group hover:border-white/10 transition-all duration-500"
                            >
                              <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                                  <limit.icon size={20} />
                                </div>
                                <div>
                                  <label className="text-[13px] font-bold text-white block tracking-tight">
                                    {limit.l}
                                  </label>
                                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                                    {limit.d}
                                  </p>
                                </div>
                              </div>
                              <div className="space-y-4">
                                <div className="flex items-center gap-6">
                                  <div className="flex-1 relative h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{
                                        width: `${(settings[limit.k] || limit.default) * 5}%`,
                                      }}
                                      className="absolute h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                    />
                                    <input
                                      type="range"
                                      min="1"
                                      max="20"
                                      value={settings[limit.k] || limit.default}
                                      onChange={(e) =>
                                        setSettings({
                                          ...settings,
                                          [limit.k]:
                                            parseInt(e.target.value) ||
                                            limit.default,
                                        })
                                      }
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                  </div>
                                  <div className="min-w-[60px]">
                                    <input
                                      type="number"
                                      min="1"
                                      max="50"
                                      value={settings[limit.k] || limit.default}
                                      onChange={(e) =>
                                        setSettings({
                                          ...settings,
                                          [limit.k]:
                                            parseInt(e.target.value) ||
                                            limit.default,
                                        })
                                      }
                                      className="apex-input w-full text-center text-xs font-mono py-1.5 px-0.5"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div className="apex-card p-8 space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                              {t("guild.antiraid.protections.antiLink_l")}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {t("guild.ui.filtering")}
                                </label>
                                <select
                                  value={settings.antiLinkType || "all"}
                                  onChange={(e) =>
                                    setSettings({
                                      ...settings,
                                      antiLinkType: e.target.value,
                                    })
                                  }
                                  className="apex-input w-full appearance-none"
                                >
                                  <option value="all">
                                    {t("guild.ui.all_links")}
                                  </option>
                                  <option value="invites">
                                    {t("guild.ui.discord_invites")}
                                  </option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {t("guild.ui.sanction")}
                                </label>
                                <button
                                  onClick={() =>
                                    setSettings({
                                      ...settings,
                                      antiLinkSanction:
                                        settings.antiLinkSanction === 0 ? 1 : 0,
                                    })
                                  }
                                  className={`apex-button-secondary w-full ${settings.antiLinkSanction === 0 ? "text-zinc-500" : "text-emerald-400 border-emerald-500/30"}`}
                                >
                                  {settings.antiLinkSanction === 0
                                    ? t("guild.ui.delete_only")
                                    : t("guild.ui.delete_and_sanction")}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.ui.ignored_channels")}
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {textChannels.map((c) => {
                                  const ignored =
                                    settings.antiLinkIgnoredChannels || [];
                                  const checked = ignored.includes(c.id);
                                  return (
                                    <label
                                      key={c.id}
                                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-accent-500/60 ${checked ? "bg-zinc-100 border-white text-zinc-950" : "bg-zinc-900/20 border-zinc-900 text-zinc-500 hover:border-zinc-700"}`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={checked}
                                        onChange={() => {
                                          const next = checked
                                            ? ignored.filter(
                                                (id) => id !== c.id,
                                              )
                                            : [...ignored, c.id];
                                          setSettings({
                                            ...settings,
                                            antiLinkIgnoredChannels: next,
                                          });
                                        }}
                                      />
                                      <Hash size={14} />
                                      <span className="text-[10px] font-bold uppercase truncate">
                                        {c.name}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="apex-card p-8 space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                              {t("guild.ui.badwords_title")}
                            </h3>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newBadword}
                                onChange={(e) => setNewBadword(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addBadword();
                                }}
                                placeholder={t("guild.ui.badword_placeholder")}
                                className="apex-input flex-1"
                              />
                              <button
                                onClick={addBadword}
                                aria-label={t("common.add")}
                                className="apex-button-primary px-4 flex items-center justify-center"
                              >
                                <Plus size={16} aria-hidden="true" />
                              </button>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {t("guild.ui.antirank_target")}
                                </label>
                                <select
                                  value={settings.antiRankType || "danger"}
                                  onChange={(e) =>
                                    setSettings({
                                      ...settings,
                                      antiRankType: e.target.value,
                                    })
                                  }
                                  className="apex-input w-full appearance-none"
                                >
                                  <option value="danger">
                                    {t("guild.ui.sensitive_roles")}
                                  </option>
                                  <option value="all">
                                    {t("guild.ui.all_roles")}
                                  </option>
                                </select>
                              </div>
                              <div className="w-36">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {t("guild.ui.mute_ms")}
                                </label>
                                <input
                                  type="number"
                                  min="60000"
                                  step="60000"
                                  value={settings.muteDuration || 300000}
                                  onChange={(e) =>
                                    setSettings({
                                      ...settings,
                                      muteDuration:
                                        parseInt(e.target.value) || 300000,
                                    })
                                  }
                                  className="apex-input w-full"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-2 custom-scrollbar">
                              {badwords.length === 0 ? (
                                <span className="text-[10px] text-zinc-600 font-mono uppercase">
                                  {t("guild.ui.no_word_configured")}
                                </span>
                              ) : (
                                badwords.map((word) => (
                                  <button
                                    key={word}
                                    onClick={() => deleteBadword(word)}
                                    aria-label={`${t("common.delete")} ${word}`}
                                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/30 text-[10px] font-bold flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                                  >
                                    {word}
                                    <X size={12} aria-hidden="true" />
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* WHITELIST AVANCEE */}
                        <div className="glass-card p-5 sm:p-10 border-white/5 space-y-8">
                          <div>
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-6 flex items-center gap-3">
                              <ShieldCheck
                                size={18}
                                className="text-emerald-400"
                              />
                              {t("guild.antiraid.whitelist.title")}
                            </h3>
                            <p className="text-[11px] text-zinc-500 font-mono mt-3 leading-relaxed">
                              {t("guild.antiraid.whitelist.desc")}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-4 items-end bg-zinc-900/30 p-5 rounded-2xl border border-zinc-800">
                            <div className="flex-1 min-w-[200px]">
                              <label className="text-[10px] text-zinc-500 font-mono block mb-2">
                                {t("guild.antiraid.whitelist.user_id")}
                              </label>
                              <div className="relative">
                                <User
                                  size={14}
                                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                                />
                                <input
                                  type="text"
                                  placeholder={t("guild.ui.wl_id_placeholder")}
                                  value={newWlUserId}
                                  onChange={(e) =>
                                    setNewWlUserId(e.target.value)
                                  }
                                  className="apex-input pl-9 w-full font-mono text-xs"
                                />
                              </div>
                            </div>
                            <div className="flex-[2] min-w-[250px]">
                              <label className="text-[10px] text-zinc-500 font-mono block mb-2">
                                {t("guild.antiraid.whitelist.initial_bypass")}
                              </label>
                              <input
                                type="text"
                                value={newWlBypasses.join(",")}
                                onChange={(e) =>
                                  setNewWlBypasses(
                                    e.target.value
                                      .split(",")
                                      .map((s) => s.trim()),
                                  )
                                }
                                className="apex-input w-full font-mono text-xs text-zinc-400 focus:text-white"
                              />
                            </div>
                            <button
                              onClick={handleAddWlUser}
                              className="h-10 px-6 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl transition-all font-bold text-xs flex items-center gap-2"
                            >
                              <Plus size={14} /> {t("common.add")}
                            </button>
                          </div>

                          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {antiraidWhitelist.length === 0 && (
                              <div className="text-center py-10 bg-black/20 rounded-xl border border-dashed border-zinc-800">
                                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                                  {t("guild.antiraid.whitelist.no_users")}
                                </p>
                              </div>
                            )}
                            {antiraidWhitelist.map((wl) => (
                              <div
                                key={wl.userId}
                                className="p-5 bg-zinc-950/50 border border-zinc-800 rounded-2xl flex flex-col gap-4 group hover:border-zinc-700 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                                      <User
                                        size={14}
                                        className="text-zinc-500"
                                      />
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-white block">
                                        ID: {wl.userId}
                                      </span>
                                      <span className="text-[10px] font-mono text-emerald-400 capitalize">
                                        {wl.bypasses.includes("*")
                                          ? t(
                                              "guild.antiraid.whitelist.total_bypass",
                                            )
                                          : `${wl.bypasses.length} ${t("guild.antiraid.whitelist.privileges")}`}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleRemoveWlUser(wl.userId)
                                    }
                                    aria-label={`${t("common.delete")} ${wl.userId}`}
                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                                  >
                                    <Trash size={14} aria-hidden="true" />
                                  </button>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-900">
                                  <button
                                    onClick={() =>
                                      handleToggleWlBypass(
                                        wl.userId,
                                        "*",
                                        wl.bypasses,
                                      )
                                    }
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${wl.bypasses.includes("*") ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600"}`}
                                  >
                                    ALL (*)
                                  </button>
                                  {[
                                    "antiSpam",
                                    "antiLink",
                                    "antiBadWords",
                                    "antiBot",
                                    "antiMassMention",
                                    "antiNuke",
                                    "antiChannel",
                                    "antiRole",
                                  ].map((bp) => (
                                    <button
                                      key={bp}
                                      onClick={() =>
                                        handleToggleWlBypass(
                                          wl.userId,
                                          bp,
                                          wl.bypasses,
                                        )
                                      }
                                      disabled={wl.bypasses.includes("*")}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all border ${wl.bypasses.includes("*") ? "opacity-30 cursor-not-allowed bg-transparent border-zinc-900 text-zinc-600" : wl.bypasses.includes(bp) ? "bg-blue-600/20 text-blue-400 border-blue-500/30" : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600"}`}
                                    >
                                      {bp.replace("anti", "")}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-6">
                          <button
                            onClick={saveSettings}
                            disabled={saving}
                            className="apex-button-primary flex-1 flex items-center justify-center gap-3 py-5 text-sm group relative overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            {saving ? (
                              <Loader2 size={18} className="animate-spin" />
                            ) : (
                              <Shield
                                size={18}
                                className="group-hover:rotate-12 transition-transform"
                              />
                            )}
                            {t("guild.antiraid.update_security")}
                          </button>
                          <button
                            onClick={() =>
                              setSettings({
                                ...settings,
                                raidMode: !settings.raidMode,
                              })
                            }
                            className={`flex-1 flex items-center justify-center gap-3 py-5 text-sm rounded-xl font-bold transition-all duration-500 border-2 ${settings.raidMode ? "bg-rose-500 border-rose-400 text-white shadow-[0_0_30px_rgba(244,63,94,0.3)]" : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-700"}`}
                          >
                            <div
                              className={`w-3 h-3 rounded-full ${settings.raidMode ? "bg-white animate-pulse" : "bg-zinc-700"}`}
                            ></div>
                            {t("guild.antiraid.raid_mode")}:{" "}
                            {settings.raidMode
                              ? t("common.active")
                              : t("common.inactive")}
                          </button>
                        </div>
                      </div>
                    )}
                    {/* ----- VOCAL STATS ----- */}
                    {activeModuleConfig === "vocal_stats" && (
                      <div className="space-y-8">
                        <div className="apex-card p-5 sm:p-10 space-y-10">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-900 pb-8">
                            <div>
                              <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-3">
                                <BarChart3
                                  size={24}
                                  className="text-zinc-600"
                                />
                                {t("guild.vocal_stats.title")}
                              </h3>
                              <p className="text-[11px] text-zinc-500 font-mono mt-2 uppercase tracking-widest">
                                {t("guild.vocal_stats.desc")}
                              </p>
                            </div>
                            <button
                              onClick={deployVocalStats}
                              disabled={deployingStats || saving}
                              className="apex-button-primary px-8 py-4 flex items-center justify-center gap-3 group relative overflow-hidden"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                              {deployingStats ? (
                                <Loader2
                                  size={18}
                                  className="animate-spin text-emerald-400"
                                />
                              ) : (
                                <RefreshCw
                                  size={18}
                                  className="group-hover:rotate-180 transition-transform duration-500"
                                />
                              )}
                              <span className="text-sm font-bold uppercase tracking-widest">
                                {t("guild.vocal_stats.init_network")}
                              </span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-8">
                              <div className="space-y-4">
                                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Sliders size={12} />
                                  {t("guild.vocal_stats.formats")}
                                </h4>
                                <div className="space-y-6 bg-zinc-900/10 p-6 rounded-2xl border border-zinc-900/50">
                                  <div className="space-y-2">
                                    <label className="text-[9px] font-mono text-zinc-600 uppercase block tracking-widest">
                                      {t("guild.vocal_stats.global_format")}
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="・{emoji}・{name} :"
                                      value={vocalStatsConfig.format || ""}
                                      onChange={(e) =>
                                        setVocalStatsConfig({
                                          ...vocalStatsConfig,
                                          format: e.target.value,
                                        })
                                      }
                                      className="apex-input w-full text-lg font-bold font-mono py-4"
                                    />
                                    <p className="text-[9px] text-zinc-700 font-mono font-medium">
                                      Variables: {`{emoji}`}, {`{name}`},{" "}
                                      {`{value}`}
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[9px] font-mono text-zinc-600 uppercase block tracking-widest">
                                      {t("guild.vocal_stats.invite_code")}
                                    </label>
                                    <div className="relative">
                                      <Globe
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700"
                                        size={14}
                                      />
                                      <input
                                        type="text"
                                        placeholder={t("guild.ui.stats_invite_placeholder")}
                                        value={statsInviteCode}
                                        onChange={(e) =>
                                          setStatsInviteCode(e.target.value)
                                        }
                                        className="apex-input w-full pl-12 font-mono"
                                      />
                                    </div>
                                    <p className="text-[9px] text-zinc-700 font-mono italic">
                                      {t("guild.vocal_stats.invite_desc")}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                                <p className="text-[10px] text-amber-500 font-mono leading-relaxed">
                                  <AlertCircle
                                    size={10}
                                    className="inline mr-2 mb-0.5"
                                  />
                                  {t("guild.vocal_stats.note")}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Terminal size={12} />
                                {t("guild.vocal_stats.network_state")}
                              </h4>
                              <div className="grid grid-cols-1 gap-3">
                                {[
                                  {
                                    k: "categoryId",
                                    l: t("guild.vocal_stats.cat_core"),
                                    icon: LayoutDashboard,
                                  },
                                  {
                                    k: "membersId",
                                    l: t("guild.vocal_stats.pop_index"),
                                    icon: Users,
                                  },
                                  {
                                    k: "onlineId",
                                    l: t("guild.vocal_stats.active_conn"),
                                    icon: Globe,
                                  },
                                  {
                                    k: "vocalId",
                                    l: t("guild.vocal_stats.vocal_flux"),
                                    icon: Megaphone,
                                  },
                                  {
                                    k: "topId",
                                    l: t("guild.vocal_stats.top_step"),
                                    icon: Crown,
                                  },
                                  {
                                    k: "inviteId",
                                    l: t("guild.vocal_stats.affiliate"),
                                    icon: ArrowUpRight,
                                  },
                                ].map((f) => (
                                  <div
                                    key={f.k}
                                    className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-zinc-900 group hover:border-zinc-800 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      <f.icon
                                        size={14}
                                        className="text-zinc-700 group-hover:text-zinc-500 transition-colors"
                                      />
                                      <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                                        {f.l}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-zinc-300 font-mono bg-zinc-900 px-3 py-1 rounded border border-zinc-800">
                                      {vocalStatsConfig.config?.[f.k] ||
                                        "NOT_FOUND"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="pt-10 border-t border-zinc-900 flex justify-end">
                            <button
                              onClick={saveVocalStats}
                              disabled={saving}
                              className="apex-button-primary px-12 py-4 flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest"
                            >
                              {saving ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Save size={18} />
                              )}
                              {t("guild.vocal_stats.sync_settings")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----- MODERATION (Roles & Perms) ----- */}
                    {activeModuleConfig === "moderation" && (
                      <div className="space-y-8">
                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.moderation.staff_hierarchy")}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.moderation.mod_role")}
                              </label>
                              <select
                                value={settings.modRole || ""}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    modRole: e.target.value || null,
                                  })
                                }
                                className="apex-input w-full appearance-none"
                              >
                                <option value="">{t("common.none")}</option>
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.moderation.auto_role")}
                              </label>
                              <select
                                value={settings.autoRole || ""}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    autoRole: e.target.value || null,
                                  })
                                }
                                className="apex-input w-full appearance-none"
                              >
                                <option value="">{t("common.disabled")}</option>
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={saveSettings}
                            className="apex-button-primary w-full flex items-center justify-center gap-2"
                          >
                            <Crown size={16} />{" "}
                            {t("guild.moderation.save_roles")}
                          </button>
                        </div>

                        <div className="apex-card p-8 space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                              {t("guild.moderation.granular_perms")}
                            </h3>
                            <div className="relative">
                              <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                                size={12}
                              />
                              <input
                                type="text"
                                placeholder={t("guild.moderation.search_cmd")}
                                value={permSearch}
                                onChange={(e) => setPermSearch(e.target.value)}
                                className="apex-input pl-9 py-1.5 text-[10px] w-full md:w-64"
                              />
                            </div>
                          </div>
                          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {availableCommands
                              .filter((cmd) =>
                                cmd
                                  .toLowerCase()
                                  .includes(permSearch.toLowerCase()),
                              )
                              .sort()
                              .map((cmd) => (
                                <div
                                  key={cmd}
                                  className="flex flex-col gap-3 p-4 bg-zinc-900/10 rounded-xl border border-zinc-900/30 hover:border-zinc-800 transition-colors"
                                >
                                  <p className="text-[10px] font-bold font-mono text-zinc-400 tracking-tighter">
                                    {settings.prefix || "/"}
                                    {cmd}
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {roles.map((role) => {
                                      const isAllowed = permissions.some(
                                        (p) =>
                                          p.roleId === role.id &&
                                          p.commandName === cmd,
                                      );
                                      return (
                                        <button
                                          key={role.id}
                                          onClick={() =>
                                            handlePermissionChange(
                                              role.id,
                                              cmd,
                                              isAllowed,
                                            )
                                          }
                                          className={`px-2.5 py-1 rounded-md text-[8px] font-bold uppercase tracking-tighter border transition-all ${isAllowed ? "bg-zinc-100 text-zinc-950 border-white" : "bg-transparent text-zinc-600 border-zinc-900 hover:border-zinc-700"}`}
                                        >
                                          {role.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.moderation.sanction_dm")}
                          </h3>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <Switch
                                id="sanctionDm-switch"
                                checked={!!settings.sanctionDm}
                                onChange={(v) =>
                                  setSettings({ ...settings, sanctionDm: v })
                                }
                                label={t("guild.moderation.enable_dm")}
                              />
                              <label
                                htmlFor="sanctionDm-switch"
                                className="text-[10px] font-mono text-zinc-400 uppercase cursor-pointer select-none"
                              >
                                {t("guild.moderation.enable_dm")}
                              </label>
                            </div>
                            {settings.sanctionDm && (
                              <div>
                                <label
                                  htmlFor="sanctionDmMessage"
                                  className="text-[10px] font-mono text-zinc-500 uppercase block mb-2"
                                >
                                  {t("guild.moderation.dm_msg")}
                                </label>
                                <textarea
                                  id="sanctionDmMessage"
                                  className="apex-input w-full h-24"
                                  value={settings.sanctionDmMessage || ""}
                                  onChange={(e) =>
                                    setSettings({
                                      ...settings,
                                      sanctionDmMessage: e.target.value,
                                    })
                                  }
                                  placeholder={t(
                                    "guild.moderation.dm_placeholder",
                                  )}
                                />
                                <p className="text-[10px] text-zinc-600 mt-2">
                                  {t("guild.moderation.variables")}:{" "}
                                  {`{action}`} (banni(e), averti(e), etc),{" "}
                                  {`{server}`}, {`{reason}`}
                                </p>
                              </div>
                            )}
                            <button
                              onClick={saveSettings}
                              className="apex-button-primary w-full flex items-center justify-center gap-2"
                            >
                              <Save size={16} /> {t("guild.moderation.save_dm")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----- WELCOME ----- */}
                    {activeModuleConfig === "welcome" && (
                      <div className="space-y-8">
                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.welcome.title")}
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.welcome.channel")}
                              </label>
                              <select
                                value={settings.welcomeChannel || ""}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    welcomeChannel: e.target.value || null,
                                  })
                                }
                                className="apex-input w-full appearance-none"
                              >
                                <option value="">{t("common.disabled")}</option>
                                {channels
                                  .filter((c) => c.type === 0)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      #{c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.welcome.message")}
                              </label>
                              <textarea
                                className="apex-input w-full h-24"
                                value={settings.welcomeMessage || ""}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    welcomeMessage: e.target.value,
                                  })
                                }
                                placeholder={t("guild.welcome.msg_placeholder")}
                              />
                              <p className="text-[10px] text-zinc-600 mt-2">
                                {t("guild.moderation.variables")}: {`{user}`},{" "}
                                {`{server}`}, {`{membercount}`}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.welcome.dm_title")}
                          </h3>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <Switch
                                id="welcomeDm-switch"
                                checked={!!settings.welcomeDm}
                                onChange={(v) =>
                                  setSettings({ ...settings, welcomeDm: v })
                                }
                                label={t("guild.welcome.enable_dm")}
                              />
                              <label
                                htmlFor="welcomeDm-switch"
                                className="text-[10px] font-mono text-zinc-400 uppercase cursor-pointer select-none"
                              >
                                {t("guild.welcome.enable_dm")}
                              </label>
                            </div>
                            {settings.welcomeDm && (
                              <div>
                                <label
                                  htmlFor="welcomeDmMessage"
                                  className="text-[10px] font-mono text-zinc-500 uppercase block mb-2"
                                >
                                  {t("guild.welcome.dm_msg")}
                                </label>
                                <textarea
                                  id="welcomeDmMessage"
                                  className="apex-input w-full h-24"
                                  value={settings.welcomeDmMessage || ""}
                                  onChange={(e) =>
                                    setSettings({
                                      ...settings,
                                      welcomeDmMessage: e.target.value,
                                    })
                                  }
                                  placeholder={t(
                                    "guild.welcome.msg_placeholder",
                                  )}
                                />
                                <p className="text-[10px] text-zinc-600 mt-2">
                                  {t("guild.moderation.variables")}: {`{user}`},{" "}
                                  {`{server}`}, {`{membercount}`}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.welcome.goodbye_title")}
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.welcome.goodbye_channel")}
                              </label>
                              <select
                                value={settings.goodbyeChannel || ""}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    goodbyeChannel: e.target.value || null,
                                  })
                                }
                                className="apex-input w-full appearance-none"
                              >
                                <option value="">{t("common.disabled")}</option>
                                {channels
                                  .filter((c) => c.type === 0)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      #{c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.welcome.goodbye_msg")}
                              </label>
                              <textarea
                                className="apex-input w-full h-24"
                                value={settings.goodbyeMessage || ""}
                                onChange={(e) =>
                                  setSettings({
                                    ...settings,
                                    goodbyeMessage: e.target.value,
                                  })
                                }
                                placeholder={t(
                                  "guild.welcome.goodbye_placeholder",
                                )}
                              />
                              <p className="text-[10px] text-zinc-600 mt-2">
                                {t("guild.moderation.variables")}: {`{user}`},{" "}
                                {`{server}`}, {`{membercount}`}
                              </p>
                            </div>
                            <button
                              onClick={saveSettings}
                              className="apex-button-primary w-full flex items-center justify-center gap-2"
                            >
                              <Save size={16} /> {t("common.save")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----- JOIN PING ----- */}
                    {activeModuleConfig === "joinping" && (
                      <div className="space-y-8">
                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.joinping.title")}
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.joinping.channels")}
                              </label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {channels
                                  .filter((c) => c.type === 0)
                                  .map((c) => (
                                    <label
                                      key={c.id}
                                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer focus-within:ring-2 focus-within:ring-accent-500/60 ${settings.joinPingChannels?.includes(c.id) ? "bg-zinc-100 border-white text-zinc-950" : "bg-zinc-900/20 border-zinc-900 text-zinc-500 hover:border-zinc-800"}`}
                                    >
                                      <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={
                                          settings.joinPingChannels?.includes(
                                            c.id,
                                          ) || false
                                        }
                                        onChange={() => {
                                          const current =
                                            settings.joinPingChannels || [];
                                          const next = current.includes(c.id)
                                            ? current.filter(
                                                (id) => id !== c.id,
                                              )
                                            : [...current, c.id];
                                          setSettings({
                                            ...settings,
                                            joinPingChannels: next,
                                          });
                                        }}
                                      />
                                      <Hash size={14} />
                                      <span className="text-[10px] font-bold uppercase tracking-tight truncate">
                                        {c.name}
                                      </span>
                                    </label>
                                  ))}
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.joinping.mode")}
                              </label>
                              <div className="grid grid-cols-2 gap-4">
                                <button
                                  onClick={() =>
                                    setSettings({
                                      ...settings,
                                      joinPingMode: "ghost",
                                    })
                                  }
                                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.joinPingMode === "ghost" ? "bg-zinc-100 border-white text-zinc-950" : "bg-zinc-900/20 border-zinc-900 text-zinc-500 hover:border-zinc-800"}`}
                                >
                                  <Ghost size={20} />
                                  <div className="text-center">
                                    <p className="text-[10px] font-bold uppercase">
                                      Ghost
                                    </p>
                                    <p className="text-[8px] opacity-60">
                                      {t("guild.joinping.ghost_desc")}
                                    </p>
                                  </div>
                                </button>
                                <button
                                  onClick={() =>
                                    setSettings({
                                      ...settings,
                                      joinPingMode: "permanent",
                                    })
                                  }
                                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.joinPingMode === "permanent" ? "bg-zinc-100 border-white text-zinc-950" : "bg-zinc-900/20 border-zinc-900 text-zinc-500 hover:border-zinc-800"}`}
                                >
                                  <Pin size={20} />
                                  <div className="text-center">
                                    <p className="text-[10px] font-bold uppercase">
                                      Permanent
                                    </p>
                                    <p className="text-[8px] opacity-60">
                                      {t("guild.joinping.perm_desc")}
                                    </p>
                                  </div>
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={saveSettings}
                              className="apex-button-primary w-full flex items-center justify-center gap-2"
                            >
                              <Save size={16} /> {t("common.save")}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----- TICKETS ----- */}
                    {activeModuleConfig === "tickets" && (
                      <div className="space-y-8">
                        <div className="apex-card p-8 space-y-8">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.tickets.title")}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.tickets.category")}
                              </label>
                              <select
                                value={ticketConfig.categoryId || ""}
                                onChange={(e) =>
                                  setTicketConfig({
                                    ...ticketConfig,
                                    categoryId: e.target.value || null,
                                  })
                                }
                                className="apex-input w-full appearance-none"
                              >
                                <option value="">{t("common.none")}</option>
                                {categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.tickets.support_role")}
                              </label>
                              <select
                                value={ticketConfig.roleId || ""}
                                onChange={(e) =>
                                  setTicketConfig({
                                    ...ticketConfig,
                                    roleId: e.target.value || null,
                                  })
                                }
                                className="apex-input w-full appearance-none"
                              >
                                <option value="">{t("common.none")}</option>
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.tickets.logs")}
                              </label>
                              <select
                                value={ticketConfig.logsChannelId || ""}
                                onChange={(e) =>
                                  setTicketConfig({
                                    ...ticketConfig,
                                    logsChannelId: e.target.value || null,
                                  })
                                }
                                className="apex-input w-full appearance-none"
                              >
                                <option value="">{t("common.none")}</option>
                                {channels
                                  .filter((c) => c.type === 0)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      #{c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.tickets.panel_title")}
                              </label>
                              <input
                                type="text"
                                value={ticketConfig.title || ""}
                                onChange={(e) =>
                                  setTicketConfig({
                                    ...ticketConfig,
                                    title: e.target.value,
                                  })
                                }
                                className="apex-input w-full"
                                placeholder={t("guild.ui.ticket_panel_placeholder")}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <textarea
                                value={ticketConfig.description || ""}
                                onChange={(e) =>
                                  setTicketConfig({
                                    ...ticketConfig,
                                    description: e.target.value,
                                  })
                                }
                                className="apex-input w-full min-h-[80px]"
                                placeholder={t("guild.tickets.panel_desc")}
                              />
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <button
                              onClick={saveTickets}
                              disabled={saving}
                              className="apex-button-primary flex-1 flex items-center justify-center gap-2"
                            >
                              <Save size={16} />{" "}
                              {t("guild.tickets.save_config")}
                            </button>
                            <button
                              onClick={deployTicketPanel}
                              disabled={deployingTicket}
                              className="apex-button-secondary flex-1 flex items-center justify-center gap-2 border-zinc-700"
                            >
                              {deployingTicket ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Megaphone size={16} />
                              )}{" "}
                              {t("guild.tickets.deploy_panel")}
                            </button>
                          </div>
                        </div>

                        <div className="apex-card p-8 space-y-6">
                          <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                              {t("guild.tickets.options_title")}
                            </h3>
                            <button
                              onClick={addTicketOption}
                              className="text-[10px] font-bold text-zinc-500 hover:text-white flex items-center gap-1 uppercase transition-colors"
                            >
                              <Plus size={12} /> {t("guild.tickets.new_option")}
                            </button>
                          </div>

                          {editingOption && (
                            <motion.div
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-6 bg-zinc-900/40 rounded-xl border border-zinc-100/10 space-y-6 mb-6"
                            >
                              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h4 className="text-[10px] font-bold uppercase text-zinc-400">
                                  {t("guild.tickets.editor")}
                                </h4>
                                <button
                                  onClick={() => setEditingOption(null)}
                                  aria-label={t("common.cancel")}
                                  className="text-zinc-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 rounded"
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                    {t("guild.tickets.opt_title")}
                                  </label>
                                  <input
                                    type="text"
                                    value={editingOption.title}
                                    onChange={(e) =>
                                      setEditingOption({
                                        ...editingOption,
                                        title: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                    {t("guild.tickets.emoji")}
                                  </label>
                                  <input
                                    type="text"
                                    value={editingOption.emoji}
                                    onChange={(e) =>
                                      setEditingOption({
                                        ...editingOption,
                                        emoji: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                    {t("guild.tickets.desc")}
                                  </label>
                                  <input
                                    type="text"
                                    value={editingOption.description}
                                    onChange={(e) =>
                                      setEditingOption({
                                        ...editingOption,
                                        description: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs"
                                  />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                    {t("guild.tickets.role_opt")}
                                  </label>
                                  <select
                                    value={editingOption.roleId || ""}
                                    onChange={(e) =>
                                      setEditingOption({
                                        ...editingOption,
                                        roleId: e.target.value || null,
                                      })
                                    }
                                    className="apex-input w-full text-xs appearance-none"
                                  >
                                    <option value="">
                                      {t("guild.tickets.default_support")}
                                    </option>
                                    {roles.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <button
                                onClick={saveTicketOption}
                                disabled={saving}
                                className="apex-button-primary w-full text-[10px] py-2 flex items-center justify-center gap-2"
                              >
                                {saving ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}{" "}
                                {t("common.save")}
                              </button>
                            </motion.div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {ticketOptions.map((opt) => (
                              <div
                                key={opt.id}
                                className="p-4 bg-zinc-900/30 rounded-xl border border-zinc-800/50 flex justify-between items-start group hover:border-zinc-700 transition-colors"
                              >
                                <div className="flex gap-4">
                                  <span className="text-xl">{opt.emoji}</span>
                                  <div>
                                    <p className="text-xs font-bold text-white mb-1">
                                      {opt.title}
                                    </p>
                                    <p className="text-[9px] text-zinc-600 font-mono tracking-tighter">
                                      {opt.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setEditingOption(opt)}
                                    aria-label={`${t("guild.tickets.editor")} ${opt.title}`}
                                    className="text-zinc-800 hover:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 rounded"
                                  >
                                    <Edit2 size={14} aria-hidden="true" />
                                  </button>
                                  <button
                                    onClick={() => deleteTicketOption(opt.id)}
                                    aria-label={`${t("common.delete")} ${opt.title}`}
                                    className="text-zinc-800 hover:text-rose-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded"
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----- ECONOMY ----- */}
                    {activeModuleConfig === "economy" && (
                      <div className="space-y-8">
                        <div className="apex-card p-8 bg-zinc-900/20 border-zinc-800">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4 mb-6">
                            {t("guild.economy.title")}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1.5">
                                  {t("guild.economy.name")}
                                </label>
                                <input
                                  type="text"
                                  value={economySettings.currencyName}
                                  onChange={(e) =>
                                    setEconomySettings({
                                      ...economySettings,
                                      currencyName: e.target.value,
                                    })
                                  }
                                  className="apex-input w-full"
                                  placeholder={t("guild.ui.currency_name_placeholder")}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1.5">
                                  {t("guild.economy.emoji")}
                                </label>
                                <input
                                  type="text"
                                  value={economySettings.currencyEmoji}
                                  onChange={(e) =>
                                    setEconomySettings({
                                      ...economySettings,
                                      currencyEmoji: e.target.value,
                                    })
                                  }
                                  className="apex-input w-full"
                                  placeholder={t("guild.ui.currency_emoji_placeholder")}
                                />
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1.5">
                                    {t("guild.economy.min_work")}
                                  </label>
                                  <input
                                    type="number"
                                    value={economySettings.minWork}
                                    onChange={(e) =>
                                      setEconomySettings({
                                        ...economySettings,
                                        minWork: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1.5">
                                    {t("guild.economy.max_work")}
                                  </label>
                                  <input
                                    type="number"
                                    value={economySettings.maxWork}
                                    onChange={(e) =>
                                      setEconomySettings({
                                        ...economySettings,
                                        maxWork: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1.5">
                                    {t("guild.economy.min_daily")}
                                  </label>
                                  <input
                                    type="number"
                                    value={economySettings.minDaily}
                                    onChange={(e) =>
                                      setEconomySettings({
                                        ...economySettings,
                                        minDaily: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1.5">
                                    {t("guild.economy.max_daily")}
                                  </label>
                                  <input
                                    type="number"
                                    value={economySettings.maxDaily}
                                    onChange={(e) =>
                                      setEconomySettings({
                                        ...economySettings,
                                        maxDaily: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-8 pt-8 border-t border-zinc-900">
                            <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-4">
                              {t("guild.economy.drop_channels")}
                            </label>
                            <p className="text-[9px] text-zinc-600 font-mono mb-4 italic">
                              {t("guild.economy.drop_desc")}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {textChannels.map((channel) => {
                                const isSelected =
                                  economySettings.dropChannels?.includes(
                                    channel.id,
                                  );
                                return (
                                  <button
                                    key={channel.id}
                                    onClick={() => {
                                      const current =
                                        economySettings.dropChannels || [];
                                      const next = isSelected
                                        ? current.filter(
                                            (id) => id !== channel.id,
                                          )
                                        : [...current, channel.id];
                                      setEconomySettings({
                                        ...economySettings,
                                        dropChannels: next,
                                      });
                                    }}
                                    className={`flex items-center gap-2 p-3 rounded-xl border text-[10px] font-mono transition-all ${
                                      isSelected
                                        ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                                        : "bg-zinc-900/40 border-zinc-800/50 text-zinc-600 hover:border-zinc-700"
                                    }`}
                                  >
                                    <Hash
                                      size={12}
                                      className={
                                        isSelected
                                          ? "text-emerald-500"
                                          : "text-zinc-700"
                                      }
                                    />
                                    <span className="truncate">
                                      {channel.name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <button
                            onClick={saveEconomySettings}
                            disabled={saving}
                            className="apex-button-primary w-full mt-8 py-3 flex items-center justify-center gap-2"
                          >
                            {saving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}{" "}
                            {t("common.save")}
                          </button>
                        </div>

                        <div className="apex-card p-8 bg-zinc-900/20 border-zinc-800 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4 mb-6">
                            {t("guild.economy.members")}
                          </h3>

                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
                              size={16}
                            />
                            <input
                              type="text"
                              placeholder={t(
                                "guild.economy.search_placeholder",
                              )}
                              value={economySearch}
                              onChange={(e) => setEconomySearch(e.target.value)}
                              className="apex-input w-full pl-10"
                            />
                            {searchingEconomy && (
                              <Loader2
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 animate-spin"
                                size={16}
                              />
                            )}
                          </div>

                          {economySearch.length >= 2 &&
                            economySearchResults.length > 0 && (
                              <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-3">
                                <p className="text-[9px] font-mono text-zinc-500 uppercase">
                                  {t("guild.economy.global_results")}
                                </p>
                                {economySearchResults.map((user) => {
                                  const dbUser = economyUsers.find(
                                    (u) => u.userId === user.id,
                                  );
                                  return (
                                    <div
                                      key={user.id}
                                      className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50"
                                    >
                                      <div className="flex items-center gap-3">
                                        {user.avatar ? (
                                          <img
                                            src={user.avatar}
                                            className="w-7 h-7 rounded-md"
                                            alt=""
                                          />
                                        ) : (
                                          <div className="w-7 h-7 rounded-md bg-zinc-800" />
                                        )}
                                        <div>
                                          <p className="text-xs font-bold text-white">
                                            {user.username}
                                          </p>
                                          <p className="text-[9px] font-mono text-zinc-600">
                                            {user.id}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() =>
                                            setEditingEconomy({
                                              userId: user.id || user.userId,
                                              username: user.username,
                                              walletType: "coins",
                                              action: "set",
                                              amount: dbUser ? dbUser.coins : 0,
                                            })
                                          }
                                          className="text-[9px] font-bold text-emerald-500 hover:bg-emerald-500/10 px-2 py-1 rounded transition-colors uppercase"
                                        >
                                          {t("guild.economy.manage_cash")}
                                        </button>
                                        <button
                                          onClick={() =>
                                            setEditingEconomy({
                                              userId: user.id || user.userId,
                                              username: user.username,
                                              walletType: "bank",
                                              action: "set",
                                              amount: dbUser ? dbUser.bank : 0,
                                            })
                                          }
                                          className="text-[9px] font-bold text-blue-500 hover:bg-blue-500/10 px-2 py-1 rounded transition-colors uppercase"
                                        >
                                          {t("guild.economy.manage_bank")}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                          {editingEconomy && (
                            <motion.div
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-6 bg-blue-900/10 rounded-xl border border-blue-500/20 space-y-6"
                            >
                              <div className="flex justify-between items-center border-b border-blue-900/40 pb-3">
                                <h4 className="text-[10px] font-bold text-blue-400">
                                  {t("guild.economy.edit_wallet")} -{" "}
                                  {editingEconomy.username}
                                </h4>
                                <button
                                  onClick={() => setEditingEconomy(null)}
                                  aria-label={t("common.cancel")}
                                  className="text-blue-600 hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded"
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                    {t("common.action")}
                                  </label>
                                  <select
                                    value={editingEconomy.action}
                                    onChange={(e) =>
                                      setEditingEconomy({
                                        ...editingEconomy,
                                        action: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs"
                                  >
                                    <option value="add">
                                      {t("guild.economy.add_action")}
                                    </option>
                                    <option value="remove">
                                      {t("guild.economy.remove_action")}
                                    </option>
                                    <option value="set">
                                      {t("guild.economy.set_action")}
                                    </option>
                                    <option value="reset">
                                      {t("guild.economy.reset_action")}
                                    </option>
                                  </select>
                                </div>
                                {editingEconomy.action !== "reset" && (
                                  <div>
                                    <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                      {t("common.amount")}
                                    </label>
                                    <input
                                      type="number"
                                      value={editingEconomy.amount}
                                      onChange={(e) =>
                                        setEditingEconomy({
                                          ...editingEconomy,
                                          amount: e.target.value,
                                        })
                                      }
                                      className="apex-input w-full text-xs"
                                    />
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={updateEconomy}
                                disabled={saving}
                                className="apex-button-primary w-full text-[10px] py-2.5 flex items-center justify-center gap-2"
                              >
                                {saving ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}{" "}
                                {t("common.apply")}
                              </button>
                            </motion.div>
                          )}

                          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {economyUsers
                              .filter(
                                (u) =>
                                  u.username
                                    ?.toLowerCase()
                                    .includes(economySearch.toLowerCase()) ||
                                  u.userId?.includes(economySearch),
                              )
                              .map((user, idx) => (
                                <div
                                  key={user.userId}
                                  className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-zinc-900/10 rounded-xl border border-zinc-900/30 hover:border-zinc-800 transition-colors gap-4"
                                >
                                  <div className="flex items-center gap-4">
                                    {user.avatar ? (
                                      <img
                                        src={user.avatar}
                                        className="w-8 h-8 rounded-lg"
                                        alt=""
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-zinc-800" />
                                    )}
                                    <div>
                                      <p className="text-xs font-bold text-white">
                                        {user.username}
                                      </p>
                                      <p className="text-[9px] font-mono text-zinc-600">
                                        {user.userId}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="text-right">
                                      <p className="text-[9px] font-mono text-zinc-500 uppercase mb-0.5">
                                        {t("guild.ui.cash")}
                                      </p>
                                      <button
                                        onClick={() =>
                                          setEditingEconomy({
                                            userId: user.userId,
                                            username: user.username,
                                            walletType: "coins",
                                            action: "set",
                                            amount: user.coins,
                                          })
                                        }
                                        className="text-sm font-bold text-emerald-400 hover:underline"
                                      >
                                        {user.coins.toLocaleString()}{" "}
                                        {economySettings.currencyEmoji}
                                      </button>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[9px] font-mono text-zinc-500 uppercase mb-0.5">
                                        {t("guild.ui.bank")}
                                      </p>
                                      <button
                                        onClick={() =>
                                          setEditingEconomy({
                                            userId: user.userId,
                                            username: user.username,
                                            walletType: "bank",
                                            action: "set",
                                            amount: user.bank,
                                          })
                                        }
                                        className="text-sm font-bold text-blue-400 hover:underline"
                                      >
                                        {user.bank.toLocaleString()}{" "}
                                        {economySettings.currencyEmoji}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            {economyUsers.length === 0 && (
                              <p className="text-center text-zinc-600 font-mono text-[10px] py-4">
                                {t("guild.economy.no_user")}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ----- CASINO ----- */}
                    {activeModuleConfig === "casino" && (
                      <div className="space-y-8">
                        {/* CONFIGURATION DES RÉCOMPENSES */}
                        <div className="apex-card p-8 bg-zinc-900/40">
                          <div className="flex items-center gap-4 mb-6 border-b border-zinc-800 pb-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                              <Gift size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                                {t("guild.casino.rewards")}
                              </h3>
                              <p className="text-[9px] font-mono text-zinc-500 uppercase">
                                {t("guild.casino.rewards_desc")}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                              { id: "common", name: t("guild.casino.common") },
                              { id: "rare", name: t("guild.casino.rare") },
                              { id: "epic", name: t("guild.casino.epic") },
                              {
                                id: "legendary",
                                name: t("guild.casino.legendary"),
                              },
                            ].map((tier) => (
                              <div key={tier.id}>
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {tier.name}
                                </label>
                                <select
                                  multiple
                                  className="apex-input w-full h-32"
                                  value={
                                    casinoConfig.rewards?.find(
                                      (r) => r.tier === tier.id,
                                    )?.roleIds || []
                                  }
                                  onChange={(e) => {
                                    const selectedRoles = Array.from(
                                      e.target.selectedOptions,
                                    ).map((opt) => opt.value);
                                    const newRewards = [
                                      ...(casinoConfig.rewards || []),
                                    ];
                                    const idx = newRewards.findIndex(
                                      (r) => r.tier === tier.id,
                                    );
                                    if (idx !== -1)
                                      newRewards[idx].roleIds = selectedRoles;
                                    else
                                      newRewards.push({
                                        tier: tier.id,
                                        roleIds: selectedRoles,
                                      });
                                    setCasinoConfig({
                                      ...casinoConfig,
                                      rewards: newRewards,
                                    });
                                  }}
                                >
                                  {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[8px] font-mono text-zinc-600 mt-1 uppercase">
                                  {t("guild.casino.ctrl_tip")}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* PERSONNALISATION DE L'EMBED */}
                        <div className="apex-card p-8 bg-zinc-900/40">
                          <div className="flex items-center gap-4 mb-6 border-b border-zinc-800 pb-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                              <Edit2 size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                                {t("guild.casino.custom")}
                              </h3>
                              <p className="text-[9px] font-mono text-zinc-500 uppercase">
                                {t("guild.casino.custom_desc")}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {t("guild.casino.min_level")}
                                </label>
                                <input
                                  type="number"
                                  className="apex-input w-full"
                                  value={casinoConfig.settings?.minLevel || 0}
                                  onChange={(e) =>
                                    setCasinoConfig({
                                      ...casinoConfig,
                                      settings: {
                                        ...casinoConfig.settings,
                                        minLevel: parseInt(e.target.value) || 0,
                                      },
                                    })
                                  }
                                  placeholder="0"
                                />
                                <p className="text-[10px] text-zinc-600 italic">
                                  {t("guild.casino.min_level_desc")}
                                </p>
                              </div>
                              <div>
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {t("guild.casino.embed_title")}
                                </label>
                                <input
                                  type="text"
                                  className="apex-input w-full"
                                  value={
                                    casinoConfig.settings?.embedTitle || ""
                                  }
                                  onChange={(e) =>
                                    setCasinoConfig({
                                      ...casinoConfig,
                                      settings: {
                                        ...casinoConfig.settings,
                                        embedTitle: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder={t("guild.ui.casino_embed_title_default", { name: stats?.guild?.name || "Server" })}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {t("guild.casino.embed_color")}
                                </label>
                                <input
                                  type="text"
                                  className="apex-input w-full"
                                  value={
                                    casinoConfig.settings?.embedColor || ""
                                  }
                                  onChange={(e) =>
                                    setCasinoConfig({
                                      ...casinoConfig,
                                      settings: {
                                        ...casinoConfig.settings,
                                        embedColor: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder={t("guild.ui.casino_color_placeholder")}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.casino.embed_desc")}
                              </label>
                              <textarea
                                className="apex-input w-full h-24"
                                value={
                                  casinoConfig.settings?.embedDescription || ""
                                }
                                onChange={(e) =>
                                  setCasinoConfig({
                                    ...casinoConfig,
                                    settings: {
                                      ...casinoConfig.settings,
                                      embedDescription: e.target.value,
                                    },
                                  })
                                }
                                placeholder={t("guild.ui.casino_embed_placeholder")}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                {t("guild.casino.embed_img")}
                              </label>
                              <input
                                type="text"
                                className="apex-input w-full"
                                value={casinoConfig.settings?.embedImage || ""}
                                onChange={(e) =>
                                  setCasinoConfig({
                                    ...casinoConfig,
                                    settings: {
                                      ...casinoConfig.settings,
                                      embedImage: e.target.value,
                                    },
                                  })
                                }
                                placeholder={t("guild.ui.casino_image_placeholder")}
                              />
                            </div>

                            <div className="pt-4 border-t border-zinc-800">
                              <div className="flex items-center justify-between mb-4">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase">
                                  {t("guild.casino.show_emojis")}
                                </label>
                                <Switch
                                  checked={
                                    casinoConfig.settings?.showEmojis === true
                                  }
                                  onChange={(v) =>
                                    setCasinoConfig({
                                      ...casinoConfig,
                                      settings: {
                                        ...casinoConfig.settings,
                                        showEmojis: v,
                                      },
                                    })
                                  }
                                  label={t("guild.casino.show_emojis")}
                                />
                              </div>
                              <p className="text-[8px] font-mono text-zinc-600 mb-4 uppercase">
                                {t("guild.casino.emojis_desc")}
                              </p>

                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                  {
                                    k: "labelProfile",
                                    l: t("guild.casino.btn_profile"),
                                    d: "Profil",
                                  },
                                  {
                                    k: "labelDraw",
                                    l: t("guild.casino.btn_draw"),
                                    d: "Tirage",
                                  },
                                  {
                                    k: "labelShop",
                                    l: t("guild.casino.btn_shop"),
                                    d: "Shop",
                                  },
                                  {
                                    k: "labelInv",
                                    l: t("guild.casino.btn_inv"),
                                    d: "Inventaire",
                                  },
                                  {
                                    k: "labelSuccess",
                                    l: t("guild.casino.btn_success"),
                                    d: "Succès",
                                  },
                                ].map((f) => (
                                  <div key={f.k}>
                                    <label className="text-[9px] font-mono text-zinc-600 uppercase block mb-1.5">
                                      {f.l}
                                    </label>
                                    <input
                                      type="text"
                                      className="apex-input w-full text-[11px]"
                                      value={casinoConfig.settings?.[f.k] || ""}
                                      onChange={(e) =>
                                        setCasinoConfig({
                                          ...casinoConfig,
                                          settings: {
                                            ...casinoConfig.settings,
                                            [f.k]: e.target.value,
                                          },
                                        })
                                      }
                                      placeholder={f.d}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* MESSAGES DE RÉSULTATS */}
                        <div className="apex-card p-8 bg-zinc-900/40">
                          <div className="flex items-center gap-4 mb-6 border-b border-zinc-800 pb-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                              <Hash size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                                {t("guild.casino.result_msgs")}
                              </h3>
                              <p className="text-[9px] font-mono text-zinc-500 uppercase">
                                Variables: {"{user}"}, {"{coins}"}, {"{role}"},{" "}
                                {"{item}"}, {"{currency}"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-6">
                            {[
                              {
                                k: "msgNothing",
                                l: t("guild.casino.nothing"),
                                p: t("guild.casino.nothing_p"),
                              },
                              {
                                k: "msgCoins",
                                l: t("guild.casino.coins"),
                                p: t("guild.casino.coins_p"),
                              },
                              {
                                k: "msgRole",
                                l: t("guild.casino.role"),
                                p: t("guild.casino.role_p"),
                              },
                              {
                                k: "msgItem",
                                l: t("guild.casino.item"),
                                p: t("guild.casino.item_p"),
                              },
                            ].map((f) => (
                              <div key={f.k}>
                                <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                                  {f.l}
                                </label>
                                <input
                                  type="text"
                                  className="apex-input w-full"
                                  value={casinoConfig.settings?.[f.k] || ""}
                                  onChange={(e) =>
                                    setCasinoConfig({
                                      ...casinoConfig,
                                      settings: {
                                        ...casinoConfig.settings,
                                        [f.k]: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder={f.p}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* DÉPLOIEMENT */}
                        <div className="apex-card p-8 bg-indigo-500/5 border-indigo-500/20">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                              <Terminal size={20} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                                {t("guild.casino.deploy")}
                              </h3>
                              <p className="text-[9px] font-mono text-zinc-500 uppercase">
                                {t("guild.casino.deploy_desc")}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <select
                              className="apex-input flex-1"
                              value={deployChannel}
                              onChange={(e) => setDeployChannel(e.target.value)}
                            >
                              <option value="">
                                {t("guild.casino.select_channel")}
                              </option>
                              {textChannels.map((c) => (
                                <option key={c.id} value={c.id}>
                                  # {c.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={async () => {
                                if (!deployChannel) {
                                  showError(t("guild.casino.select_channel"));
                                  return;
                                }
                                setSaving(true);
                                try {
                                  const res = await apiFetch(
                                    `/guilds/${guildId}/casino/deploy`,
                                    {
                                      method: "POST",
                                      body: JSON.stringify({
                                        channelId: deployChannel,
                                      }),
                                    },
                                  );
                                  if (res.ok)
                                    showSuccess(
                                      t("notifications.shop_deployed"),
                                    );
                                  else throw new Error();
                                } catch (e) {
                                  showError(e.message);
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                              className="apex-button-primary px-8 flex items-center gap-2"
                            >
                              <Send size={16} /> {t("common.deploy")}
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={async () => {
                            setSaving(true);
                            try {
                              const res = await apiFetch(
                                `/guilds/${guildId}/casino/settings`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({ casinoConfig }),
                                },
                              );
                              if (res.ok)
                                showSuccess(t("notifications.casino_saved"));
                              else throw new Error();
                            } catch (e) {
                              showError(e.message);
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving}
                          className="apex-button-primary w-full py-4 flex items-center justify-center gap-2 text-lg font-bold"
                        >
                          {saving ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : (
                            <Save size={20} />
                          )}{" "}
                          {t("guild.casino.save_all")}
                        </button>
                      </div>
                    )}

                    {/* ----- LEVELS ----- */}
                    {activeModuleConfig === "levels" && (
                      <div className="space-y-8">
                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.levels.title")}
                          </h3>
                          <div>
                            <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-2">
                              {t("guild.levels.channel")}
                            </label>
                            <select
                              value={settings.levelChannel || ""}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  levelChannel: e.target.value || null,
                                })
                              }
                              className="apex-input w-full appearance-none"
                            >
                              <option value="">
                                {t("guild.levels.no_channel")}
                              </option>
                              {channels
                                .filter((c) => c.type === 0)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                          <button
                            onClick={saveSettings}
                            disabled={saving}
                            className="apex-button-primary w-full flex items-center justify-center gap-2"
                          >
                            {saving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}{" "}
                            {t("guild.levels.save_channel")}
                          </button>
                        </div>

                        <div className="apex-card p-8 space-y-6">
                          <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">
                              {t("guild.levels.rewards")}
                            </h3>
                            <button
                              onClick={() =>
                                setEditingLevelRole({ level: "", roleId: "" })
                              }
                              className="apex-button-secondary text-[10px] py-1.5 px-3 flex items-center gap-2"
                            >
                              <Plus size={12} /> {t("guild.levels.add_reward")}
                            </button>
                          </div>

                          {editingLevelRole && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-6 bg-zinc-900/40 rounded-xl border border-zinc-100/10 space-y-4 mb-6"
                            >
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-[10px] font-bold text-white uppercase">
                                  {t("guild.levels.new_config")}
                                </h4>
                                <button
                                  onClick={() => setEditingLevelRole(null)}
                                  aria-label={t("common.cancel")}
                                  className="text-zinc-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 rounded"
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                    {t("guild.levels.level_req")}
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={editingLevelRole.level}
                                    onChange={(e) =>
                                      setEditingLevelRole({
                                        ...editingLevelRole,
                                        level: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs"
                                    placeholder={t("guild.ui.level_value_placeholder")}
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-mono text-zinc-500 uppercase block mb-1">
                                    {t("guild.levels.role_to_give")}
                                  </label>
                                  <select
                                    value={editingLevelRole.roleId}
                                    onChange={(e) =>
                                      setEditingLevelRole({
                                        ...editingLevelRole,
                                        roleId: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs"
                                  >
                                    <option value="">
                                      {t("guild.levels.select_role")}
                                    </option>
                                    {roles.map((r) => (
                                      <option key={r.id} value={r.id}>
                                        {r.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <button
                                onClick={saveLevelRole}
                                disabled={saving}
                                className="apex-button-primary w-full text-[10px] py-2 flex items-center justify-center gap-2"
                              >
                                {saving ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}{" "}
                                {t("guild.levels.confirm_reward")}
                              </button>
                            </motion.div>
                          )}

                          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                            {levelRoles.length === 0 ? (
                              <p className="text-[10px] text-zinc-600 font-mono text-center py-4">
                                {t("guild.levels.no_rewards")}
                              </p>
                            ) : (
                              levelRoles.map((roleCfg) => (
                                <div
                                  key={roleCfg.id}
                                  className="flex items-center justify-between p-4 bg-zinc-900/10 rounded-xl border border-zinc-900/40 hover:border-zinc-800 transition-colors"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-950 flex flex-col items-center justify-center font-black">
                                      <span className="text-[8px] leading-none uppercase">
                                        {t("guild.ui.level_short")}
                                      </span>
                                      <span className="text-sm leading-none">
                                        {roleCfg.level}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-white">
                                        {t("guild.ui.reward_role")}
                                      </p>
                                      <p className="text-[10px] font-mono text-emerald-400">
                                        @
                                        {roles.find(
                                          (r) => r.id === roleCfg.roleId,
                                        )?.name || t("guild.ui.unknown_role")}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        setEditingLevelRole(roleCfg)
                                      }
                                      aria-label={`${t("guild.levels.new_config")} ${roleCfg.level}`}
                                      className="text-zinc-500 hover:text-white p-2 bg-zinc-900 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60"
                                    >
                                      <Edit2 size={12} aria-hidden="true" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        deleteLevelRole(roleCfg.id)
                                      }
                                      aria-label={`${t("common.delete")} ${roleCfg.level}`}
                                      className="text-red-400/50 hover:text-red-400 p-2 bg-zinc-900 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                                    >
                                      <Trash2 size={12} aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="apex-card p-8 space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                            {t("guild.levels.members_xp")}
                          </h3>

                          <div className="relative">
                            <div className="relative">
                              <Search
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500"
                                size={16}
                              />
                              <input
                                type="text"
                                value={memberSearch}
                                onChange={(e) =>
                                  setMemberSearch(e.target.value)
                                }
                                placeholder={t(
                                  "guild.economy.search_placeholder",
                                )}
                                className="apex-input w-full pl-10 bg-zinc-950/50"
                              />
                              {searchingMembers && (
                                <Loader2
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 animate-spin"
                                  size={16}
                                />
                              )}
                            </div>

                            {memberSearchResults.length > 0 && (
                              <div className="absolute w-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                                {memberSearchResults.map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() => {
                                      setEditingLevelUser({
                                        userId: user.id,
                                        username: user.username,
                                        avatar: user.avatar,
                                        action: "add",
                                        amount: "",
                                      });
                                      setMemberSearchResults([]);
                                      setMemberSearch("");
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-zinc-800/50 flex items-center gap-3 transition-colors border-b border-zinc-800/50 last:border-0"
                                  >
                                    {user.avatar ? (
                                      <img
                                        src={user.avatar}
                                        className="w-8 h-8 rounded-lg"
                                        alt=""
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-zinc-800" />
                                    )}
                                    <div>
                                      <p className="text-xs font-bold text-white max-w-[200px] truncate">
                                        {user.username}
                                      </p>
                                      <p className="text-[9px] font-mono text-zinc-500">
                                        {user.id}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {editingLevelUser && (
                            <motion.div
                              initial={{ opacity: 0, y: -20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-6 bg-emerald-900/10 rounded-xl border border-emerald-500/20 space-y-6 mb-6"
                            >
                              <div className="flex justify-between items-center border-b border-emerald-900/40 pb-3">
                                <h4 className="text-[10px] font-bold text-emerald-400 flex items-center gap-2">
                                  {editingLevelUser.avatar ||
                                  levelUsers.find(
                                    (u) => u.id === editingLevelUser.userId,
                                  )?.avatar ? (
                                    <img
                                      src={
                                        editingLevelUser.avatar ||
                                        levelUsers.find(
                                          (u) =>
                                            u.id === editingLevelUser.userId,
                                        )?.avatar
                                      }
                                      className="w-5 h-5 rounded-full"
                                      alt=""
                                    />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-zinc-800" />
                                  )}
                                  {t("guild.levels.edit_xp")} -{" "}
                                  {editingLevelUser.username ||
                                    levelUsers.find(
                                      (u) => u.id === editingLevelUser.userId,
                                    )?.username}
                                </h4>
                                <button
                                  onClick={() => setEditingLevelUser(null)}
                                  aria-label={t("common.cancel")}
                                  className="text-emerald-600 hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded"
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9px] font-mono text-emerald-500/70 uppercase block mb-1">
                                    {t("common.action")}
                                  </label>
                                  <select
                                    value={editingLevelUser.action}
                                    onChange={(e) =>
                                      setEditingLevelUser({
                                        ...editingLevelUser,
                                        action: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs !border-emerald-900/50 focus:!border-emerald-500"
                                  >
                                    <option value="add">
                                      {t("guild.economy.add_action")}
                                    </option>
                                    <option value="remove">
                                      {t("guild.economy.remove_action")}
                                    </option>
                                    <option value="set">
                                      {t("guild.economy.set_action")}
                                    </option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] font-mono text-emerald-500/70 uppercase block mb-1">
                                    XP {t("common.amount")}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingLevelUser.amount}
                                    onChange={(e) =>
                                      setEditingLevelUser({
                                        ...editingLevelUser,
                                        amount: e.target.value,
                                      })
                                    }
                                    className="apex-input w-full text-xs !border-emerald-900/50 focus:!border-emerald-500"
                                    placeholder={t("guild.ui.xp_value_placeholder")}
                                  />
                                </div>
                              </div>
                              <button
                                onClick={updateLevelXP}
                                disabled={saving}
                                className="w-full text-emerald-950 bg-emerald-400 hover:bg-emerald-300 font-bold uppercase tracking-widest text-[10px] py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
                              >
                                {saving ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}{" "}
                                {t("common.confirm")}
                              </button>
                            </motion.div>
                          )}

                          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {levelUsers.length === 0 ? (
                              <p className="text-[10px] text-center text-zinc-600 font-mono py-8">
                                {t("guild.levels.no_xp")}
                              </p>
                            ) : (
                              levelUsers.map((user, idx) => (
                                <div
                                  key={user.id}
                                  className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-zinc-900/10 rounded-xl border border-zinc-900/30 hover:border-zinc-800 transition-colors gap-4"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-zinc-500 font-mono shrink-0">
                                      #{idx + 1}
                                    </div>
                                    {user.avatar ? (
                                      <img
                                        src={user.avatar}
                                        className="w-8 h-8 rounded-lg"
                                        alt=""
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-lg bg-zinc-800" />
                                    )}
                                    <div>
                                      <p className="text-xs font-bold text-white">
                                        {user.username}
                                      </p>
                                      <p className="text-[9px] font-mono text-zinc-600">
                                        {user.id}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-8">
                                    <div className="text-right">
                                      <p className="text-[9px] font-mono text-zinc-500 uppercase mb-0.5">
                                        {t("guild.ui.level")}
                                      </p>
                                      <p className="text-sm font-bold text-white text-center">
                                        {user.level}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[9px] font-mono text-zinc-500 uppercase mb-0.5">
                                        {t("guild.ui.experience")}
                                      </p>
                                      <p className="text-sm font-bold text-emerald-400">
                                        {user.xp.toLocaleString()} XP
                                      </p>
                                    </div>
                                    <button
                                      onClick={() =>
                                        setEditingLevelUser({
                                          userId: user.id,
                                          action: "add",
                                          amount: "",
                                        })
                                      }
                                      className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Empty state for modules without dedicated configuration UI */}
                    {![
                      "core",
                      "logs",
                      "antiraid",
                      "moderation",
                      "tickets",
                      "economy",
                      "levels",
                      "casino",
                      "welcome",
                      "vocal_stats",
                      "joinping",
                    ].includes(activeModuleConfig) && (
                      <div className="rounded-xl bg-neutral-900 ring-1 ring-white/5 shadow-soft p-6 sm:p-10 flex flex-col items-center justify-center min-h-[320px] text-center">
                        <div className="w-12 h-12 rounded-xl bg-accent-500/10 ring-1 ring-accent-500/30 flex items-center justify-center mb-5">
                          <Settings size={22} className="text-accent-400" />
                        </div>
                        <h3 className="text-lg font-semibold tracking-tight text-white mb-1">
                          {t("guild.ui.module_not_configured")}
                        </h3>
                        <p className="text-sm text-neutral-400 max-w-sm mx-auto mb-6">
                          {t("guild.ui.module_auto_managed")}
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveModuleConfig(null)}
                          className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent-500 hover:bg-accent-400 text-white transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/60 flex items-center gap-2 shadow-soft"
                        >
                          <ChevronLeft size={14} /> {t("guild.ui.back_to_modules")}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SIDEBAR STATUS */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="apex-card p-6 bg-zinc-900/20">
                      <h4 className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-4">
                        {t("guild.status.node_sequencer")}
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                            {t("guild.ui.core_process")}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-500 uppercase">
                            {t("guild.status.stable")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                            {t("guild.ui.memory_load")}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-200 uppercase">
                            12.4%
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                            {t("guild.status.active_module")}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-200 uppercase">
                            {activeModuleConfig}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="apex-card p-6 border-zinc-900/50 bg-white/[0.01]">
                      <p className="text-[10px] text-zinc-700 font-mono leading-relaxed">
                        {t("guild.status.changes_tip")} <br />
                        <br />
                        {t("guild.status.local_tip")}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "audit" && (
              <motion.div
                key="audit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="apex-card p-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4 flex items-center gap-2">
                    <History size={16} /> {t("guild.audit.title")}
                  </h3>
                  <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-900">
                    <table className="w-full min-w-[640px] text-left text-xs font-mono">
                      <thead className="bg-zinc-900/50 text-zinc-500 uppercase tracking-widest">
                        <tr>
                          <th className="p-4">{t("guild.audit.user")}</th>
                          <th className="p-4">{t("guild.audit.action")}</th>
                          <th className="p-4">{t("guild.audit.details")}</th>
                          <th className="p-4 text-right">
                            {t("guild.audit.date")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 bg-black/20">
                        {auditLogs.map((log) => (
                          <tr
                            key={log.id}
                            className="hover:bg-zinc-900/10 transition-colors"
                          >
                            <td className="p-4 font-bold text-zinc-300">
                              {log.username}{" "}
                              <span className="text-[9px] text-zinc-600">
                                ({log.userId})
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 bg-zinc-900 rounded text-[10px] text-emerald-500">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4 text-zinc-500 truncate max-w-xs">
                              {log.details}
                            </td>
                            <td className="p-4 text-right text-zinc-600">
                              {new Date(log.timestamp * 1000).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "security" && (
              <motion.div
                key="security"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="apex-card p-8">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                      <ShieldCheck size={16} /> {t("guild.security.title")}
                    </h3>
                    <span className="text-[9px] font-mono text-zinc-600 bg-zinc-900 px-2 py-1 rounded">
                      {t("guild.security.owner_only")}
                    </span>
                  </div>
                  <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-900">
                    <table className="w-full min-w-[640px] text-left text-xs font-mono">
                      <thead className="bg-zinc-900/50 text-zinc-500 uppercase tracking-widest">
                        <tr>
                          <th className="p-4">{t("guild.audit.user")}</th>
                          <th className="p-4">{t("guild.security.ip")}</th>
                          <th className="p-4">{t("common.status")}</th>
                          <th className="p-4 text-right">
                            {t("guild.audit.date")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 bg-black/20">
                        {securityLogs.map((log) => (
                          <tr
                            key={log.id}
                            className="hover:bg-zinc-900/10 transition-colors"
                          >
                            <td className="p-4 font-bold text-zinc-300">
                              {log.username}{" "}
                              <span className="text-[9px] text-zinc-600">
                                ({log.userId})
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-blue-400">{log.ip}</span>
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${log.status === "success" ? "bg-emerald-900/20 text-emerald-500" : "bg-rose-900/20 text-rose-500"}`}
                              >
                                {log.status === "success"
                                  ? t("guild.security.allowed")
                                  : t("guild.security.failed")}
                              </span>
                            </td>
                            <td className="p-4 text-right text-zinc-600">
                              {new Date(log.timestamp * 1000).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "giveaways" && (
              <motion.div
                key="giveaways"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-10"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* Création Giveaway */}
                  <div className="lg:col-span-5 apex-card p-8 bg-zinc-900/20 h-fit">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4 mb-6">
                      {t("guild.giveaways.launch")}
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5">
                          {t("guild.giveaways.prize")}
                        </label>
                        <input
                          type="text"
                          className="apex-input w-full"
                          placeholder={t("guild.ui.giveaway_prize_placeholder")}
                          value={newGiveaway.prize}
                          onChange={(e) =>
                            setNewGiveaway({
                              ...newGiveaway,
                              prize: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5">
                            {t("guild.giveaways.winners")}
                          </label>
                          <input
                            type="number"
                            className="apex-input w-full"
                            value={newGiveaway.winnersCount}
                            onChange={(e) =>
                              setNewGiveaway({
                                ...newGiveaway,
                                winnersCount: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5">
                            {t("guild.giveaways.duration")}
                          </label>
                          <input
                            type="number"
                            className="apex-input w-full"
                            value={newGiveaway.duration}
                            onChange={(e) =>
                              setNewGiveaway({
                                ...newGiveaway,
                                duration: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5">
                          {t("guild.giveaways.channel")}
                        </label>
                        <select
                          className="apex-input w-full"
                          value={newGiveaway.channelId}
                          onChange={(e) =>
                            setNewGiveaway({
                              ...newGiveaway,
                              channelId: e.target.value,
                            })
                          }
                        >
                          <option value="">
                            {t("guild.giveaways.channel")}
                          </option>
                          {textChannels.map((c) => (
                            <option key={c.id} value={c.id}>
                              # {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5">
                          {t("guild.giveaways.reqs")}
                        </label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {roles.slice(0, 15).map((role) => (
                            <button
                              key={role.id}
                              onClick={() => {
                                const exists =
                                  newGiveaway.requirements.includes(role.id);
                                setNewGiveaway({
                                  ...newGiveaway,
                                  requirements: exists
                                    ? newGiveaway.requirements.filter(
                                        (id) => id !== role.id,
                                      )
                                    : [...newGiveaway.requirements, role.id],
                                });
                              }}
                              className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${newGiveaway.requirements.includes(role.id) ? "bg-emerald-500 text-black border-emerald-400" : "bg-zinc-950 text-zinc-500 border-zinc-900 hover:border-zinc-700"}`}
                            >
                              {role.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!newGiveaway.prize || !newGiveaway.channelId)
                            return showError(
                              t("guild.giveaways.prize") +
                                " & " +
                                t("guild.giveaways.channel"),
                            );
                          setSaving(true);
                          try {
                            const res = await apiFetch(
                              `/guilds/${guildId}/giveaways`,
                              {
                                method: "POST",
                                body: JSON.stringify(newGiveaway),
                              },
                            );
                            if (res.ok) {
                              showSuccess(t("notifications.cmd_sent"));
                              setNewGiveaway({
                                prize: "",
                                winnersCount: 1,
                                duration: 60,
                                channelId: "",
                                requirements: [],
                              });
                              fetchData();
                            } else throw new Error();
                          } catch {
                            showError(t("common.error"));
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving}
                        className="apex-button-primary w-full py-3 text-xs flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Gift size={16} />
                        )}{" "}
                        {t("guild.giveaways.launch_btn")}
                      </button>
                    </div>
                  </div>

                  {/* Liste Giveaways Actifs */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="apex-card p-8 bg-zinc-900/40">
                      <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">
                        {t("guild.giveaways.active")}
                      </h3>
                      <div className="space-y-4">
                        {giveaways.length === 0 ? (
                          <p className="text-center py-10 text-zinc-600 font-mono text-xs uppercase tracking-widest">
                            {t("guild.giveaways.no_active")}
                          </p>
                        ) : (
                          giveaways.map((g) => {
                            const winnerList = Array.isArray(g.winners)
                              ? g.winners
                              : [];
                            return (
                              <div
                                key={g.messageId}
                                className="bg-black/40 border border-zinc-800 p-5 rounded-lg flex flex-col gap-4"
                              >
                                <div className="flex justify-between gap-4">
                                  <div className="min-w-0">
                                    <h4 className="text-white font-bold tracking-tight flex items-center gap-2 truncate">
                                      <Gift
                                        size={14}
                                        className="text-emerald-500"
                                      />{" "}
                                      {g.prize}
                                    </h4>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 font-mono text-[9px] text-zinc-600 uppercase tracking-widest">
                                      <span>
                                        {t("guild.giveaways.host")}: {g.hostId}
                                      </span>
                                      <span>
                                        #
                                        {channels.find(
                                          (c) => c.id === g.channelId,
                                        )?.name || t("guild.ui.unknown_channel")}
                                      </span>
                                      <span>
                                        {new Date(g.endsAt).toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${g.ended ? "bg-rose-900/20 text-rose-500" : "bg-emerald-900/20 text-emerald-500"}`}
                                    >
                                      {g.ended
                                        ? t("common.ended")
                                        : t("common.active")}
                                    </span>
                                    <span className="text-[10px] font-bold text-zinc-500">
                                      {g.winnersCount}{" "}
                                      {t("guild.giveaways.winners")}
                                    </span>
                                  </div>
                                </div>
                                {g.ended && (
                                  <div className="border-t border-zinc-900 pt-3 flex flex-wrap gap-2 text-[10px] text-zinc-500 font-mono">
                                    <span>
                                      {t("guild.ui.participants")}: {g.participantsCount || 0}
                                    </span>
                                    <span>
                                      {t("guild.ui.winners_label")}:{" "}
                                      {winnerList.length
                                        ? winnerList
                                            .map((id) => `<@${id}>`)
                                            .join(", ")
                                        : t("guild.ui.none_lower")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "owners" && (
              <motion.div
                key="owners"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                <div className="apex-card p-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-zinc-900 pb-4">
                    {t("guild.owners.title")}
                  </h3>
                  <p className="text-[10px] text-zinc-600 font-mono mt-2 mb-6">
                    {t("guild.owners.desc")}
                  </p>

                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <input
                        type="text"
                        value={newOwnerId}
                        onChange={(e) => setNewOwnerId(e.target.value)}
                        placeholder={t("guild.ui.owner_id_placeholder")}
                        className="apex-input flex-1"
                      />
                      <button
                        onClick={addBotOwner}
                        disabled={saving}
                        className="apex-button-primary whitespace-nowrap flex items-center gap-2"
                      >
                        {saving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Plus size={16} />
                        )}{" "}
                        {t("guild.owners.add_btn")}
                      </button>
                    </div>

                    <div className="border-t border-zinc-900 pt-6">
                      <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-4">
                        {t("guild.owners.current")}
                      </h4>
                      {botOwners.length === 0 ? (
                        <p className="text-[10px] text-center text-zinc-600 font-mono py-8">
                          {t("guild.owners.no_owners")}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {botOwners.map((owner) => (
                            <div
                              key={owner.userId}
                              className="flex items-center justify-between p-4 bg-zinc-900/20 rounded-xl border border-zinc-800/40"
                            >
                              <div className="flex items-center gap-4">
                                {owner.avatar ? (
                                  <img
                                    src={owner.avatar}
                                    className="w-8 h-8 rounded-full"
                                    alt=""
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-zinc-800" />
                                )}
                                <div>
                                  <p className="text-xs font-bold text-white">
                                    {owner.username}
                                  </p>
                                  <p className="text-[9px] font-mono text-zinc-600">
                                    {owner.userId}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeBotOwner(owner.userId)}
                                className="text-rose-500 hover:text-rose-400 p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded"
                                title={t("guild.owners.revoke")}
                                aria-label={`${t("guild.owners.revoke")} ${owner.username || owner.userId}`}
                              >
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* STICKY SAVE BAR — shown only when isDirty */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 64, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 md:left-[19rem] md:right-6 z-40"
              role="region"
              aria-label={t("guild.ui.save_region")}
            >
              <div
                className={`rounded-xl ring-1 shadow-soft px-3 sm:px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 backdrop-blur transition-colors duration-[120ms] ${saveFlash ? "bg-accent-500/15 ring-accent-500/40" : "bg-neutral-950/90 ring-white/10"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${saveFlash ? "bg-accent-300" : "bg-amber-400 animate-pulse"}`}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-white truncate">
                    {saveFlash
                      ? t("guild.ui.settings_saved")
                      : t("guild.ui.unsaved_changes")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSettings(savedSettings)}
                    disabled={saving}
                    className="px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={saveSettings}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-accent-500 hover:bg-accent-400 text-white flex items-center gap-2 disabled:opacity-60 transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shadow-soft"
                  >
                    {saving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    {t("common.save")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOAST NOTIFICATIONS — top-right stack, aria-live polite, auto-dismiss 3s */}
        <div
          className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence>
            {successMsg && (
              <motion.div
                key="success"
                initial={{ y: -16, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="pointer-events-auto px-4 py-3 rounded-xl shadow-soft ring-1 ring-accent-500/40 bg-neutral-900/90 backdrop-blur-md text-neutral-100 flex items-center gap-3 max-w-sm"
                role="status"
              >
                <CheckCircle2 size={16} className="shrink-0 text-accent-400" />
                <span className="text-sm font-medium">{successMsg}</span>
              </motion.div>
            )}
            {error && (
              <motion.div
                key="error"
                initial={{ y: -16, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -8, opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="pointer-events-auto px-4 py-3 rounded-xl shadow-soft ring-1 ring-rose-500/40 bg-neutral-900/90 backdrop-blur-md text-neutral-100 flex items-center gap-3 max-w-sm"
                role="alert"
              >
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span className="text-sm font-medium">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CONFIRM / PROMPT MODAL — dark scrim + backdrop-blur, centered card, focus trap */}
        <AnimatePresence>
          {modalState && (
            <motion.div
              className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              onKeyDown={(e) => {
                if (e.key === "Escape")
                  closeModal(modalState.type === "prompt" ? null : false);
                if (e.key === "Tab") {
                  // simple focus trap — keep focus within modal
                  const focusables = e.currentTarget.querySelectorAll(
                    "button, input, [tabindex]:not([tabindex='-1'])",
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
                }
              }}
              onClick={() =>
                closeModal(modalState.type === "prompt" ? null : false)
              }
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.96, y: 6, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, y: 6, opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="rounded-xl bg-neutral-900 ring-1 ring-white/10 shadow-soft p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
              >
                <h2
                  id="modal-title"
                  className="text-lg font-semibold tracking-tight text-white"
                >
                  {modalState.question}
                </h2>
                {modalState.description && (
                  <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
                    {modalState.description}
                  </p>
                )}
                {modalState.type === "prompt" && (
                  <input
                    autoFocus
                    type="text"
                    value={modalState.value}
                    onChange={(e) =>
                      setModalState({ ...modalState, value: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") closeModal(modalState.value);
                    }}
                    placeholder={modalState.placeholder}
                    className="mt-4 w-full bg-neutral-950 ring-1 ring-white/10 rounded-lg px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:bg-neutral-900 transition-all duration-[120ms]"
                    aria-label={modalState.question}
                  />
                )}
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      closeModal(modalState.type === "prompt" ? null : false)
                    }
                    className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="button"
                    autoFocus={modalState.type === "confirm"}
                    onClick={() =>
                      closeModal(
                        modalState.type === "prompt"
                          ? modalState.value || null
                          : true,
                      )
                    }
                    className={`px-4 py-2 text-sm font-semibold rounded-lg text-white shadow-soft transition-colors duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      modalState.variant === "danger"
                        ? "bg-rose-600 hover:bg-rose-500"
                        : "bg-accent-500 hover:bg-accent-400"
                    }`}
                  >
                    {t("common.confirm")}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default GuildDashboard;
