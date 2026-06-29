const express = require("express");
const jwt = require("jsonwebtoken");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth } = middlewares;
  const { logAccess } = helpers;

  const rateLimit = require("express-rate-limit");
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    handler: (req, res) =>
      res
        .status(429)
        .json({ error: t(req.lang, "dashboard.auth.too_many_attempts") }),
  });

  router.post("/phrase", loginLimiter, (req, res) => {
    try {
      const { phrase } = req.body;
      if (typeof phrase !== "string" || phrase.trim() === "") {
        logAccess("unknown", "Empty Phrase", req, "failed");
        return res
          .status(401)
          .json({ error: t(req.lang, "dashboard.auth.access_denied") });
      }

      const masterPhrase = process.env.SPEED_PHRASE;
      const validPhrases = client.db.getSpeedPhrases();

      const matchedPhrase = validPhrases.find(
        (p) => p.phrase === phrase.trim(),
      );
      const isMaster = phrase.trim() === masterPhrase;

      if (!matchedPhrase && !isMaster) {
        logAccess("unknown", phrase.trim().substring(0, 10), req, "failed");
        return res
          .status(401)
          .json({ error: t(req.lang, "dashboard.auth.access_denied") });
      }

      const username = isMaster
        ? t(req.lang, "dashboard.auth.supreme_admin")
        : matchedPhrase.name;
      const primaryOwnerId = process.env.OWNER_ID
        ? process.env.OWNER_ID.split(",")[0].trim()
        : "speedphrase-user";

      logAccess(primaryOwnerId, username, req, "success");

      const token = jwt.sign(
        { id: primaryOwnerId, username: username, isSpeedPhrase: true },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );

      const forwardedProto = req.headers["x-forwarded-proto"];
      let isSecure = false;

      if (forwardedProto === "https") {
        isSecure = true;
      } else if (
        process.env.DASHBOARD_URL &&
        process.env.DASHBOARD_URL.startsWith("https")
      ) {
        isSecure = true;
      } else if (process.env.NODE_ENV === "production") {
        isSecure = true;
      }

      const cookieOptions = {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
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

  router.get("/me", requireAuth, (req, res) => {
    const owners = process.env.OWNER_ID
      ? process.env.OWNER_ID.split(",").map((id) => id.trim())
      : [];
    const isGlobalOwner =
      req.user.isSpeedPhrase || owners.includes(req.user.id);
    res.json({ authenticated: true, user: req.user, isGlobalOwner });
  });

  router.get("/login", (req, res) => {
    let redirectUri = process.env.DISCORD_REDIRECT_URI;

    const protocol =
      req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
    const host = req.headers["x-forwarded-host"] || req.headers.host;

    if (
      host &&
      host !== "localhost:3000" &&
      host !== "localhost:3001" &&
      host !== "localhost:3002"
    ) {
      const publicBase = `${protocol}://${host}`;
      redirectUri = `${publicBase}/api/auth/callback`;
      Logger.info(
        `[DASHBOARD AUTH] Using dynamic redirect URI: ${redirectUri}`,
      );
    }

    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
  });

  router.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (typeof code !== "string" || !code.trim()) {
      return res
        .status(400)
        .json({ error: "Code d'autorisation manquant ou invalide" });
    }

    try {
      let redirectUri = process.env.DISCORD_REDIRECT_URI;

      const protocol =
        req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      const host = req.headers["x-forwarded-host"] || req.headers.host;

      if (
        host &&
        host !== "localhost:3000" &&
        host !== "localhost:3001" &&
        host !== "localhost:3002"
      ) {
        const publicBase = `${protocol}://${host}`;
        redirectUri = `${publicBase}/api/auth/callback`;
        Logger.info(
          `[DASHBOARD AUTH] Using dynamic redirect URI for token exchange: ${redirectUri}`,
        );
      }

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

      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      const userData = await userResponse.json();
      logAccess(userData.id, userData.username, req, "success");

      const token = jwt.sign(
        { id: userData.id, username: userData.username },
        process.env.JWT_SECRET,
        { expiresIn: "24h" },
      );

      const forwardedProto = req.headers["x-forwarded-proto"];
      let isSecure = false;

      if (forwardedProto === "https") {
        isSecure = true;
        Logger.info(
          "[DASHBOARD AUTH] Using secure cookies (x-forwarded-proto: https)",
        );
      } else if (
        process.env.DASHBOARD_URL &&
        process.env.DASHBOARD_URL.startsWith("https")
      ) {
        isSecure = true;
        Logger.info(
          "[DASHBOARD AUTH] Using secure cookies (DASHBOARD_URL is HTTPS)",
        );
      } else if (process.env.NODE_ENV === "production") {
        isSecure = true;
        Logger.info(
          "[DASHBOARD AUTH] Using secure cookies (NODE_ENV is production)",
        );
      }

      const cookieOptions = {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
      };

      res.cookie("token", token, cookieOptions);

      res.redirect(
        `${(process.env.DASHBOARD_URL || "http://localhost:5173").replace(/\/$/, "")}/dashboard`,
      );
    } catch (error) {
      Logger.error(`[DASHBOARD AUTH ERROR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: "Erreur lors de l'authentification",
        reqId: req.reqId,
      });
    }
  });

  return router;
};
