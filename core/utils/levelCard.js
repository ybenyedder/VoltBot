const Canvas = require("@napi-rs/canvas");
const { AttachmentBuilder } = require("discord.js");
const { t } = require("./i18n");

const nfFR = new Intl.NumberFormat("fr-FR");
const nfEN = new Intl.NumberFormat("en-US");
const ACCENT = "#8B5CF6";
const ACCENT_LIGHT = "#C4B5FD";

function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillTextSpaced(ctx, text, x, y, spacing = 0) {
  if (!spacing) {
    ctx.fillText(text, x, y);
    return;
  }
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
}

/**
 * Génère une carte de niveau premium (thème sombre moderne).
 * Préserve la signature exportée : async (member, level) => AttachmentBuilder
 */
module.exports = async (member, level, lang = "fr") => {
  const nf = lang === "en" ? nfEN : nfFR;
  const canvas = Canvas.createCanvas(934, 282);
  const ctx = canvas.getContext("2d");

  // --- Fond sombre + dégradé subtil ---
  const bgGrd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGrd.addColorStop(0, "#0E0F13");
  bgGrd.addColorStop(1, "#1A1B22");
  ctx.fillStyle = bgGrd;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 18);
  ctx.fill();

  // Éclat radial accent (coin haut-droit)
  const glow = ctx.createRadialGradient(
    canvas.width - 120,
    60,
    10,
    canvas.width - 120,
    60,
    460,
  );
  glow.addColorStop(0, "rgba(139, 92, 246, 0.28)");
  glow.addColorStop(1, "rgba(139, 92, 246, 0)");
  ctx.fillStyle = glow;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 18);
  ctx.fill();

  // Bordure interne très fine
  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  roundRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 17);
  ctx.stroke();

  // --- Avatar circulaire ---
  const avatarSize = 160;
  const avatarX = 60;
  const avatarY = (canvas.height - avatarSize) / 2;
  const cx = avatarX + avatarSize / 2;
  const cy = avatarY + avatarSize / 2;

  let avatar = null;
  try {
    const avatarURL = member.user.displayAvatarURL({
      extension: "png",
      size: 256,
    });
    avatar = await Canvas.loadImage(avatarURL);
  } catch (_) {
    try {
      if (member.client && member.client.user) {
        const fallbackURL = member.client.user.displayAvatarURL({
          extension: "png",
          size: 256,
        });
        avatar = await Canvas.loadImage(fallbackURL);
      }
    } catch (_) {
      avatar = null;
    }
  }

  // Ombre douce derrière l'avatar
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#1a1b21";
  ctx.beginPath();
  ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Clip & dessin de l'avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = "#2c2f33";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  // Bordure accent autour de l'avatar
  const ringGrd = ctx.createLinearGradient(
    avatarX,
    avatarY,
    avatarX + avatarSize,
    avatarY + avatarSize,
  );
  ringGrd.addColorStop(0, ACCENT);
  ringGrd.addColorStop(1, ACCENT_LIGHT);
  ctx.beginPath();
  ctx.arc(cx, cy, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrd;
  ctx.lineWidth = 4;
  ctx.stroke();

  // --- Textes ---
  const textX = avatarX + avatarSize + 60;

  // "Félicitations !" — gros, blanc, bold
  ctx.font = "bold 56px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  fillTextSpaced(ctx, t(lang, "utils.levelCard.congrats"), textX, 105, 1.2);

  // "vous avez atteint" — gris
  ctx.font = "28px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fillText(t(lang, "utils.levelCard.you_reached"), textX, 155);

  // "le niveau X" — bold, dégradé violet
  const niveauText = t(lang, "utils.levelCard.level_x", {
    level: nf.format(level),
  });
  ctx.font = "bold 48px sans-serif";
  const niveauWidth = ctx.measureText(niveauText).width;
  const txtGrd = ctx.createLinearGradient(textX, 0, textX + niveauWidth, 0);
  txtGrd.addColorStop(0, "#FFFFFF");
  txtGrd.addColorStop(1, ACCENT_LIGHT);
  ctx.fillStyle = txtGrd;
  ctx.fillText(niveauText, textX, 220);

  // --- Encoder ---
  const buffer = await canvas.encode("png");
  return new AttachmentBuilder(buffer, { name: "levelup.png" });
};
