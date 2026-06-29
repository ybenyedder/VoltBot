const express = require("express");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGlobalOwner } = middlewares;
  const { logDashboardAction, recentErrors } = helpers;

  router.get("/speedphrases", requireAuth, requireGlobalOwner, (req, res) => {
    try {
      const phrases = client.db.getSpeedPhrases();
      res.json(phrases);
    } catch (error) {
      Logger.error(`[DASHBOARD SPEEDPHRASE GET] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: t(req.lang, "dashboard.system.speedphrases_fetch_error"),
        reqId: req.reqId,
      });
    }
  });

  router.post("/speedphrases", requireAuth, requireGlobalOwner, (req, res) => {
    const { phrase, name } = req.body;
    if (
      typeof phrase !== "string" ||
      !phrase.trim() ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({ error: "Phrase et nom requis" });
    }
    try {
      client.db.addSpeedPhrase(phrase.trim(), name.trim());
      logDashboardAction(
        null,
        req.user.id,
        req.user.username,
        "SPEEDPHRASE_ADD",
        { name: name.trim() },
      );
      res.json({ success: true });
    } catch (error) {
      Logger.error(`[DASHBOARD SPEEDPHRASE ADD] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: t(req.lang, "dashboard.system.speedphrase_add_error"),
        reqId: req.reqId,
      });
    }
  });

  router.delete(
    "/speedphrases/:phrase",
    requireAuth,
    requireGlobalOwner,
    (req, res) => {
      const phrase = decodeURIComponent(req.params.phrase || "");
      if (!phrase.trim()) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.system.speedphrase_invalid") });
      }
      try {
        client.db.removeSpeedPhrase(phrase);
        logDashboardAction(
          null,
          req.user.id,
          req.user.username,
          "SPEEDPHRASE_REMOVE",
          {},
        );
        res.json({ success: true });
      } catch (error) {
        Logger.error(
          `[DASHBOARD SPEEDPHRASE DELETE] reqId=${req.reqId}`,
          error,
        );
        res.status(500).json({
          error: t(req.lang, "dashboard.system.speedphrase_delete_error"),
          reqId: req.reqId,
        });
      }
    },
  );

  // --- RECENT ERRORS DEBUG ENDPOINTS (owner-only) ---
  // GET returns the full ring buffer including stacks; this route is gated by
  // requireGlobalOwner so stacks never leak to non-owners. The error middleware
  // itself returns a sanitised payload (no stack) to all callers regardless.
  router.get("/errors", requireAuth, requireGlobalOwner, (req, res) => {
    try {
      const list = Array.isArray(recentErrors) ? recentErrors : [];
      // Return a shallow copy of the last 100 entries so callers can't mutate
      // the live buffer via response reference reuse.
      res.json({ count: list.length, errors: list.slice(-100) });
    } catch (error) {
      Logger.error(`[DASHBOARD ERRORS GET] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: t(req.lang, "dashboard.system.recent_errors_fetch_error"),
        reqId: req.reqId,
      });
    }
  });

  router.delete("/errors", requireAuth, requireGlobalOwner, (req, res) => {
    try {
      if (Array.isArray(recentErrors)) {
        recentErrors.length = 0;
      }
      logDashboardAction(
        null,
        req.user.id,
        req.user.username,
        "RECENT_ERRORS_CLEAR",
        {},
      );
      res.json({ success: true });
    } catch (error) {
      Logger.error(`[DASHBOARD ERRORS CLEAR] reqId=${req.reqId}`, error);
      res.status(500).json({
        error: t(req.lang, "dashboard.system.recent_errors_clear_error"),
        reqId: req.reqId,
      });
    }
  });

  return router;
};
