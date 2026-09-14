const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");

// --- Hachage des phrases secrètes (scrypt natif, zéro dépendance) ---
// Format stocké : "scrypt$<saltHex>$<hashHex>". Les phrases legacy stockées
// en clair restent vérifiables via verifyPhrase (comparaison classique) et
// sont migrées automatiquement vers la forme hachée à la première validation.
const PHRASE_HASH_PREFIX = "scrypt$";
const PHRASE_HASH_KEYLEN = 64;

function hashPhrase(phrase) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(phrase), salt, PHRASE_HASH_KEYLEN);
  return `${PHRASE_HASH_PREFIX}${salt.toString("hex")}$${hash.toString("hex")}`;
}

// Comparaison en temps constant entre chaînes de longueurs potentiellement
// différentes : on consomme tout de même un timingSafeEqual (auto-comparaison)
// pour garder un temps d'exécution homogène, puis on renvoie false.
function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a), "utf8");
  const bufB = Buffer.from(String(b), "utf8");
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPhrase(phrase, stored) {
  if (typeof stored !== "string" || stored === "") return false;
  if (stored.startsWith(PHRASE_HASH_PREFIX)) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (salt.length === 0 || expected.length === 0) return false;
    const actual = crypto.scryptSync(String(phrase), salt, expected.length);
    return crypto.timingSafeEqual(actual, expected);
  }
  // Legacy plaintext (pré-hachage) : comparaison classique, pour ne pas
  // casser le login des phrases déjà stockées en clair en DB.
  return stored === phrase;
}

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth } = middlewares;
  const { logAccess } = helpers;

  // Secure cookies uniquement si le dashboard est servi en HTTPS (via
  // DASHBOARD_URL). NODE_ENV=production ne doit PAS forcer `secure`, sinon la
  // connexion casse sur un déploiement LAN en HTTP.
  const useSecure = (process.env.DASHBOARD_URL || "").startsWith("https://");

  const rateLimit = require("express-rate-limit");
  const { ipKeyGenerator } = rateLimit;
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    // Clé basée sur l'IP socket réelle : req.ip reste influençable via les
    // en-têtes X-Forwarded-* et permettrait de contourner le rate-limit.
    // ipKeyGenerator en fallback (IPv6-safe + évite la validation
    // ERR_ERL_KEY_GEN_IPV6 d'express-rate-limit v8).
    keyGenerator: (req) => req.socket?.remoteAddress || ipKeyGenerator(req),
    handler: (req, res) =>
      res
        .status(429)
        .json({ error: t(req.lang, "dashboard.auth.too_many_attempts") }),
  });

  // Limiter dédié au flux OAuth (/login + /callback) : 10 requêtes / 15 min.
  const oauthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => req.socket?.remoteAddress || ipKeyGenerator(req),
    handler: (req, res) =>
      res.status(429).json({ error: "Trop de tentatives, réessaie plus tard." }),
  });

  // Allow-list des hôtes acceptés pour construire le redirect_uri dynamique.
  // On ne trust pas x-forwarded-host brut : seuls les ports localhost de dev
  // (redirect configuré utilisé tel quel) et le host de DASHBOARD_URL (URI
  // reconstruite) sont autorisés — tout autre host renvoie un 400.
  const DEV_ALLOWED_HOSTS = new Set([
    "localhost:3000",
    "localhost:3001",
    "localhost:3002",
  ]);

  function resolveAllowedRedirectUri(req) {
    const configured = process.env.DISCORD_REDIRECT_URI;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (!host) return configured;
    const hostStr = String(host).trim().toLowerCase();

    // Dev locale : le redirect_uri configuré pointe déjà vers localhost.
    if (DEV_ALLOWED_HOSTS.has(hostStr)) return configured;

    let dashboardHost = null;
    try {
      dashboardHost = new URL(process.env.DASHBOARD_URL).host.toLowerCase();
    } catch (e) {
      // DASHBOARD_URL absent ou invalide : pas de redirect dynamique.
    }

    if (dashboardHost && hostStr === dashboardHost) {
      const protocol =
        req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      return `${protocol}://${hostStr}/api/auth/callback`;
    }

    const err = new Error(
      `Host non autorisé pour le redirect OAuth : ${hostStr}`,
    );
    err.status = 400;
    throw err;
  }

  router.post("/phrase", loginLimiter, (req, res) => {
    try {
      const { phrase } = req.body;
      if (typeof phrase !== "string" || phrase.trim() === "") {
        logAccess("unknown", "Empty Phrase", req, "failed");
        return res
          .status(401)
          .json({ error: t(req.lang, "dashboard.auth.access_denied") });
      }

      const submitted = phrase.trim();
      const masterPhrase = process.env.SPEED_PHRASE || "";
      const validPhrases = client.db.getSpeedPhrases();

      let matchedPhrase = null;
      for (const p of validPhrases) {
        if (verifyPhrase(submitted, p.phrase)) {
          matchedPhrase = p;
          break;
        }
      }
      // Master (env) : comparaison en temps constant, sans crash même si les
      // longueurs diffèrent (garde dans timingSafeEqualStr).
      const isMaster =
        masterPhrase !== "" && timingSafeEqualStr(submitted, masterPhrase);

      if (!matchedPhrase && !isMaster) {
        // Ne jamais stocker le secret tenté : on log un hash tronqué
        // (irréversible, non exploitable pour deviner la phrase).
        const attemptHash = crypto
          .createHash("sha256")
          .update(submitted)
          .digest("hex")
          .substring(0, 12);
        logAccess("unknown", attemptHash, req, "failed");
        return res
          .status(401)
          .json({ error: t(req.lang, "dashboard.auth.access_denied") });
      }

      // Migration transparente : une phrase legacy (plaintext) validée est
      // re-hachée puis mise à jour en DB — la PK étant la phrase elle-même,
      // on insère le hash puis on supprime l'ancienne ligne en clair (pas de
      // méthode d'update dédiée côté DB).
      if (
        matchedPhrase &&
        !matchedPhrase.phrase.startsWith(PHRASE_HASH_PREFIX)
      ) {
        try {
          client.db.addSpeedPhrase(hashPhrase(submitted), matchedPhrase.name);
          client.db.removeSpeedPhrase(matchedPhrase.phrase);
          Logger.info(
            `[DASHBOARD AUTH] Phrase "${matchedPhrase.name}" migrée vers un stockage haché (scrypt).`,
          );
        } catch (migrationError) {
          // On ne bloque pas le login : la phrase reste en clair en DB.
          Logger.warn(
            `[DASHBOARD AUTH] Échec de migration scrypt pour "${matchedPhrase.name}" (phrase laissée en clair) reqId=${req.reqId}`,
            migrationError,
          );
        }
      }

      const username = isMaster
        ? t(req.lang, "dashboard.auth.supreme_admin")
        : matchedPhrase.name;
      const primaryOwnerId = process.env.OWNER_ID
        ? process.env.OWNER_ID.split(/[\s,]+/)[0].trim()
        : "speedphrase-user";

      logAccess(primaryOwnerId, username, req, "success");

      const token = jwt.sign(
        { id: primaryOwnerId, username: username, isSpeedPhrase: true },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );

      const cookieOptions = {
        httpOnly: true,
        secure: useSecure,
        sameSite: useSecure ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
      };

      res.cookie("token", token, cookieOptions);
      res.json({ success: true, redirect: "/dashboard" });
    } catch (error) {
      Logger.error(`[DASHBOARD AUTH PHRASE ERROR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: "Erreur interne lors de l'authentification",
        reqId: req.reqId,
      });
    }
  });

  // Déconnexion : efface le cookie token avec les mêmes options que sa
  // création (httpOnly/secure/sameSite) pour que le clearCookie soit réellement
  // appliqué par le navigateur.
  router.post("/logout", (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: useSecure,
      sameSite: useSecure ? "none" : "lax",
    });
    res.json({ success: true });
  });

  router.get("/me", requireAuth, (req, res) => {
    const owners = process.env.OWNER_ID
      ? process.env.OWNER_ID.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean)
      : [];
    const isGlobalOwner =
      req.user.isSpeedPhrase || owners.includes(req.user.id);
    res.json({ authenticated: true, user: req.user, isGlobalOwner });
  });

  router.get("/login", oauthLimiter, (req, res) => {
    let redirectUri;
    try {
      redirectUri = resolveAllowedRedirectUri(req);
    } catch (error) {
      Logger.warn(
        `[DASHBOARD AUTH LOGIN] reqId=${req.reqId} ${error.message}`,
      );
      return res.status(error.status || 400).json({ error: error.message });
    }

    // Anti-CSRF : state aléatoire stocké dans un cookie httpOnly éphémère,
    // vérifié à la callback.
    const state = crypto.randomBytes(16).toString("hex");
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: useSecure,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    });

    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds&state=${state}`;
    res.redirect(url);
  });

  router.get("/callback", oauthLimiter, async (req, res) => {
    const code = req.query.code;
    if (typeof code !== "string" || !code.trim()) {
      return res
        .status(400)
        .json({ error: "Code d'autorisation manquant ou invalide" });
    }

    // Anti-CSRF : le state retourné par Discord doit correspondre (en temps
    // constant) au cookie oauth_state posé par /login. Le cookie est effacé
    // dans tous les cas (usage unique).
    const expectedState = req.cookies ? req.cookies.oauth_state : undefined;
    res.clearCookie("oauth_state", {
      httpOnly: true,
      secure: useSecure,
      sameSite: "lax",
    });
    if (
      typeof req.query.state !== "string" ||
      typeof expectedState !== "string" ||
      !timingSafeEqualStr(req.query.state, expectedState)
    ) {
      Logger.warn(
        `[DASHBOARD AUTH CALLBACK] State OAuth invalide reqId=${req.reqId}`,
      );
      return res
        .status(400)
        .json({ error: "State OAuth invalide ou expiré" });
    }

    try {
      // Même allow-list que /login : Discord exige un redirect_uri strictement
      // identique entre les deux appels.
      const redirectUri = resolveAllowedRedirectUri(req);

      const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectUri,
          }),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );

      const tokenData = await tokenResponse.json();
      if (tokenData.error)
        throw new Error(tokenData.error_description || tokenData.error);
      if (typeof tokenData.access_token !== "string" || !tokenData.access_token)
        throw new Error("Réponse Discord invalide (access_token manquant)");

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = await userResponse.json();
      if (!userData || !userData.id)
        throw new Error("Réponse Discord invalide (utilisateur manquant)");

      logAccess(userData.id, userData.username, req, "success");

      const token = jwt.sign(
        { id: userData.id, username: userData.username },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );

      const cookieOptions = {
        httpOnly: true,
        secure: useSecure,
        sameSite: useSecure ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
      };

      res.cookie("token", token, cookieOptions);

      // Access token Discord (consommé par /api/user/guilds) : il était
      // auparavant jeté après l'échange. Durée de vie = expires_in de Discord,
      // scoping path /api pour limiter l'exposition du cookie.
      res.cookie("discord_access_token", tokenData.access_token, {
        httpOnly: true,
        secure: useSecure,
        sameSite: useSecure ? "none" : "lax",
        maxAge: (tokenData.expires_in || 604800) * 1000,
        path: "/api",
      });

      res.redirect(
        `${(process.env.DASHBOARD_URL || "http://localhost:5173").replace(/\/$/, "")}/dashboard`,
      );
    } catch (error) {
      Logger.error(`[DASHBOARD AUTH ERROR] reqId=${req.reqId}`, error);
      res.status(error.status || 500).json({
        error: "Erreur lors de l'authentification",
        reqId: req.reqId,
      });
    }
  });

  return router;
};

// Helpers purs exposés pour les autres routes (system.js hashe les phrases
// avant stockage) — indépendants du client/middlewares.
module.exports.hashPhrase = hashPhrase;
module.exports.verifyPhrase = verifyPhrase;
module.exports.timingSafeEqualStr = timingSafeEqualStr;
