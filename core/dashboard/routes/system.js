const express = require("express");
const crypto = require("crypto");
const Logger = require("../../utils/logger.js");
const { t } = require("../../utils/i18n");
const { hashPhrase, verifyPhrase } = require("./auth.js");

// Clé opaque par phrase (sha256 tronqué de la valeur stockée) : permet à l'UI
// de viser une ligne pour la suppression sans jamais exposer la phrase (en
// clair ou hachée). La table speed_phrases n'a ni id ni createdAt (PK =
// phrase), d'où cette clé dérivée.
function phraseRowKey(stored) {
  return crypto
    .createHash("sha256")
    .update(String(stored))
    .digest("hex")
    .substring(0, 12);
}

// Préfixe masqué type "abc***" — uniquement pour les phrases legacy encore
// en clair ; les phrases hachées n'exposent rien.
function maskedPreview(stored) {
  if (typeof stored !== "string" || stored === "") return "***";
  if (stored.startsWith("scrypt$")) return "•••••";
  return stored.length <= 3 ? "***" : `${stored.substring(0, 3)}***`;
}

module.exports = function (client, middlewares, helpers) {
  const router = express.Router();
  const { requireAuth, requireGlobalOwner } = middlewares;
  const { logDashboardAction, recentErrors } = helpers;

  router.get("/speedphrases", requireAuth, requireGlobalOwner, (req, res) => {
    try {
      const phrases = client.db.getSpeedPhrases();
      // Métadonnées uniquement : ni la phrase ni le hash complet ne sortent
      // de l'API. `phrase` reste une clé de suppression opaque pour l'UI.
      res.json(
        phrases.map((p) => {
          const key = phraseRowKey(p.phrase);
          return {
            id: key,
            phrase: key, // compat client : clé passée à DELETE
            name: p.name,
            masked: maskedPreview(p.phrase),
          };
        }),
      );
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
      const submitted = phrase.trim();
      // Anti-doublon : le sel scrypt étant aléatoire, on détecte les doublons
      // par vérification avant d'insérer un nouveau hash.
      const duplicate = client.db
        .getSpeedPhrases()
        .some((p) => verifyPhrase(submitted, p.phrase));
      if (duplicate) {
        return res.status(409).json({ error: "Cette phrase existe déjà" });
      }
      // Hachage AVANT stockage : plus jamais de phrase en clair en DB via
      // cette route.
      client.db.addSpeedPhrase(hashPhrase(submitted), name.trim());
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
      const submitted = decodeURIComponent(req.params.phrase || "");
      if (!submitted.trim()) {
        return res
          .status(400)
          .json({ error: t(req.lang, "dashboard.system.speedphrase_invalid") });
      }
      try {
        // Le paramètre est soit la clé opaque renvoyée par le GET, soit la
        // phrase en clair (compat appel direct) — on supprime la valeur
        // STOCKÉE correspondante (hash ou legacy).
        const row = client.db
          .getSpeedPhrases()
          .find(
            (p) => phraseRowKey(p.phrase) === submitted ||
              verifyPhrase(submitted, p.phrase),
          );
        if (!row) {
          return res.status(404).json({ error: "Phrase introuvable" });
        }
        client.db.removeSpeedPhrase(row.phrase);
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
