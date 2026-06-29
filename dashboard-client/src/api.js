import i18n from "./i18n";

let currentBotPort =
  localStorage.getItem("api_bot_port") || window.location.port || "3000"; // Default to current or 3000
let useGateway = localStorage.getItem("api_use_gateway") === "true";

const getApiUrl = () => {
  // If we're using the Gateway approach, route through the proxy
  if (useGateway) {
    return `/api/bot/${currentBotPort}`;
  }

  // Fallback to direct port access (mostly for local dev)
  const urlPort = window.location.port;

  // If we're on a standard web port (like through Cloudflare) but target port is different,
  // we MUST use the gateway as auxiliary ports are usually not exposed.
  if (
    (!urlPort || urlPort === "80" || urlPort === "443") &&
    currentBotPort !== "3000"
  ) {
    return `/api/bot/${currentBotPort}`;
  }

  if (!urlPort || urlPort === currentBotPort) {
    return "/api";
  }
  return `${window.location.protocol}//${window.location.hostname}:${currentBotPort}/api`;
};

/**
 * Fonction de découverte de Bot par ID (ne marche que si les ports sont ouverts ou via Gateway)
 */
export async function discoverBot(accessId) {
  const ports = [3000, 3001, 3002, 3003, 3004, 3005];
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 1500) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  // 1. Try the current origin identify (New Gateway Registry)
  try {
    const res = await fetchWithTimeout(
      "/api/identify",
      { cache: "no-store" },
      2000,
    );
    if (res.ok) {
      const data = await res.json();

      // Check if it's the new Gateway Registry [Array]
      if (Array.isArray(data)) {
        const found = data.find((b) => b.accessId === accessId);
        if (found) {
          currentBotPort = found.port.toString();
          useGateway = true;
          localStorage.setItem("api_bot_port", currentBotPort);
          localStorage.setItem("api_use_gateway", "true");
          return { success: true, port: currentBotPort, data: found };
        }
      } else if (data.accessId === accessId) {
        // Direct bot identify (Legacy/Direct)
        currentBotPort = window.location.port || "3000";
        useGateway = false;
        localStorage.setItem("api_bot_port", currentBotPort);
        localStorage.setItem("api_use_gateway", "false");
        return { success: true, port: currentBotPort, data };
      }
    }
  } catch (e) {}

  // 2. Scan direct ports (mostly for local development)
  const promises = ports.map(async (port) => {
    try {
      const url = `${protocol}//${hostname}:${port}/api/identify`;
      const res = await fetchWithTimeout(url, { cache: "no-store" }, 1500);
      if (res.ok) {
        const data = await res.json();

        // Direct identify response
        if (!Array.isArray(data) && data.accessId === accessId) {
          return { success: true, port: port.toString(), data, gateway: false };
        }

        // If the direct port is actually the Gateway
        if (Array.isArray(data)) {
          const found = data.find((b) => b.accessId === accessId);
          if (found)
            return {
              success: true,
              port: found.port.toString(),
              data: found,
              gateway: true,
            };
        }
      }
    } catch (e) {}
    return null;
  });

  const results = await Promise.all(promises);
  const found = results.find((r) => r !== null);

  if (found) {
    currentBotPort = found.port;
    useGateway = found.gateway || false;
    localStorage.setItem("api_bot_port", currentBotPort);
    localStorage.setItem("api_use_gateway", useGateway ? "true" : "false");
    return found;
  }

  return { success: false, error: i18n.t("login.error_conn") };
}

/**
 * Custom fetch wrapper to include credentials and base URL
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${getApiUrl()}${endpoint}`;

  const defaultOptions = {
    ...options,
    credentials: "include", // Important pour les cookies JWT
    headers: {
      "Content-Type": "application/json",
      // Langue d'affichage courante -> le backend localise ses messages d'erreur.
      "X-Dashboard-Lang": localStorage.getItem("dashboard_lang") || "fr",
      ...options.headers,
    },
  };

  const response = await fetch(url, defaultOptions);

  // Capture the correlation ID set by the dashboard backend so callers can
  // surface it in error toasts ("please quote ID xyz when filing a bug").
  try {
    const reqId = response.headers.get("X-Request-Id");
    if (reqId) response.reqId = reqId;
  } catch (_) {
    /* response may be frozen — non-fatal */
  }

  if (response.status === 401) {
    // Rediriger vers le login si non autorisé (sauf sur la page de login elle-même)
    if (window.location.pathname !== "/") {
      window.location.replace("/");
    }
  }

  if (response.status === 429) {
    // Parse Retry-After header (seconds) and fall back to JSON body.
    const headerVal = response.headers.get("Retry-After");
    let retryAfter = parseInt(headerVal, 10);
    let message = "";
    try {
      // Clone so the caller can still read the body.
      const body = await response.clone().json();
      if (!Number.isFinite(retryAfter) && Number.isFinite(body?.retryAfter)) {
        retryAfter = body.retryAfter;
      }
      if (body?.error) message = body.error;
    } catch (_) {
      /* body wasn't JSON — ignore */
    }
    if (!Number.isFinite(retryAfter) || retryAfter < 1) retryAfter = 30;
    if (!message) message = `Trop de requêtes. Réessaie dans ${retryAfter} s.`;

    // Surface to any toast UI via a global event (no new deps).
    try {
      window.dispatchEvent(
        new CustomEvent("api:rate-limited", {
          detail: { retryAfter, message, url, endpoint },
        }),
      );
    } catch (_) {
      /* SSR or non-browser env — ignore */
    }

    // Annotate the response object so callers can read the parsed values
    // without re-parsing the headers themselves.
    try {
      response.retryAfter = retryAfter;
      response.rateLimitMessage = message;
    } catch (_) {
      /* response may be frozen in some envs — non-fatal */
    }
  }

  return response;
}
