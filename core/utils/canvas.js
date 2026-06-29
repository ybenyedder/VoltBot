const Canvas = require("@napi-rs/canvas");

const nfFR = new Intl.NumberFormat("fr-FR");
const ACCENT = "#8B5CF6"; // violet accent for progress
const ACCENT_LIGHT = "#C4B5FD";

// Lighten a hex color by mixing with white
function lighten(hex, amt = 0.4) {
  const h = hex.replace("#", "");
  const num = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.round(r + (255 - r) * amt);
  g = Math.round(g + (255 - g) * amt);
  b = Math.round(b + (255 - b) * amt);
  return `rgb(${r}, ${g}, ${b})`;
}

// Polyfill roundRect for safety
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

// Draw text with a synthetic letter-spacing (works on older canvas versions)
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

module.exports = {
  generateRankCard: async (
    user,
    level,
    xp,
    requiredXp,
    rank,
    status,
    backgroundType = "default",
  ) => {
    const canvas = Canvas.createCanvas(1000, 300);
    const ctx = canvas.getContext("2d");

    // --- Fond dynamique selon thème ---
    let gradStops;
    if (backgroundType === "bg_galaxy") {
      gradStops = ["#0B0C10", "#1F2833", "#45A29E"];
    } else if (backgroundType === "bg_hacker") {
      gradStops = ["#000000", "#001a0d", "#003300"];
    } else {
      gradStops = ["#13111C", "#1F003A", "#4B0082"];
    }

    const bgGrd = ctx.createLinearGradient(0, 0, 1000, 300);
    if (gradStops.length === 3) {
      bgGrd.addColorStop(0, gradStops[0]);
      bgGrd.addColorStop(0.55, gradStops[1]);
      bgGrd.addColorStop(1, gradStops[2]);
    } else {
      bgGrd.addColorStop(0, gradStops[0]);
      bgGrd.addColorStop(1, gradStops[1]);
    }
    ctx.fillStyle = bgGrd;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 22);
    ctx.fill();

    // Voile sombre + léger éclat radial en haut à gauche
    const glow = ctx.createRadialGradient(180, 80, 20, 180, 80, 480);
    glow.addColorStop(0, "rgba(139, 92, 246, 0.22)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 22);
    ctx.fill();

    // Carte interne (effet "verre")
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    roundRect(ctx, 20, 20, 960, 260, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- Avatar ---
    const avatarSize = 180;
    const avatarX = 50;
    const avatarY = (canvas.height - avatarSize) / 2;
    const cx = avatarX + avatarSize / 2;
    const cy = avatarY + avatarSize / 2;

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

    let avatar = null;
    try {
      const avatarUrl = user.displayAvatarURL({
        extension: "png",
        size: 512,
        forceStatic: true,
      });
      avatar = await Canvas.loadImage(avatarUrl);
    } catch (_) {
      try {
        if (user.client && user.client.user) {
          const fallbackUrl = user.client.user.displayAvatarURL({
            extension: "png",
            size: 512,
            forceStatic: true,
          });
          avatar = await Canvas.loadImage(fallbackUrl);
        }
      } catch (_) {
        avatar = null;
      }
    }

    if (avatar) {
      ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
    } else {
      ctx.fillStyle = "#2c2f33";
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    }
    ctx.restore();

    // Contour d'avatar (couleur de statut)
    let statusColor = "#43b581";
    if (status === "idle") statusColor = "#faa61a";
    else if (status === "dnd") statusColor = "#f04747";
    else if (status === "offline" || !status) statusColor = "#747f8d";

    ctx.beginPath();
    ctx.arc(cx, cy, avatarSize / 2 + 2, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = statusColor;
    ctx.stroke();

    // --- Textes ---
    const username =
      user.username && user.username.length > 16
        ? user.username.substring(0, 16) + "…"
        : user.username || "Utilisateur";

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px sans-serif";
    fillTextSpaced(ctx, username, 270, 120, 1.2);

    // Niveau
    ctx.font = "bold 34px sans-serif";
    ctx.fillStyle = ACCENT_LIGHT;
    const levelText = `Niveau ${nfFR.format(level)}`;
    ctx.fillText(levelText, 270, 178);

    // Rang (aligné à droite)
    ctx.fillStyle = "#cfcfd6";
    ctx.font = "bold 30px sans-serif";
    const rankText = `Rang #${nfFR.format(rank)}`;
    const rankWidth = ctx.measureText(rankText).width;
    ctx.fillText(rankText, canvas.width - rankWidth - 50, 120);

    // --- Barre d'XP ---
    const barWidth = 650;
    const barHeight = 36;
    const barX = 270;
    const barY = 210;
    const radius = barHeight / 2;

    // Fond de la barre
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.fill();

    // Stroke de contour subtile (couleur thème)
    ctx.strokeStyle = "rgba(139, 92, 246, 0.35)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, barX, barY, barWidth, barHeight, radius);
    ctx.stroke();

    // Progression
    const safeRequired = requiredXp > 0 ? requiredXp : 1;
    const progress = Math.max(0, Math.min(xp / safeRequired, 1));
    const currentBarWidth = barWidth * progress;

    if (currentBarWidth > 0) {
      const progressGrd = ctx.createLinearGradient(
        barX,
        barY,
        barX + barWidth,
        barY,
      );
      progressGrd.addColorStop(0, ACCENT);
      progressGrd.addColorStop(1, lighten(ACCENT, 0.45));

      ctx.fillStyle = progressGrd;
      const drawW = Math.max(currentBarWidth, barHeight);
      roundRect(ctx, barX, barY, drawW, barHeight, radius);
      ctx.fill();

      // Reflet intérieur en haut
      const highlightGrd = ctx.createLinearGradient(
        barX,
        barY,
        barX,
        barY + barHeight / 2,
      );
      highlightGrd.addColorStop(0, "rgba(255, 255, 255, 0.35)");
      highlightGrd.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = highlightGrd;
      roundRect(
        ctx,
        barX + 2,
        barY + 2,
        Math.max(drawW - 4, 1),
        barHeight / 2 - 2,
        radius,
      );
      ctx.fill();
    }

    // Texte XP centré dans la barre
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    const xpText = `${nfFR.format(xp)} / ${nfFR.format(requiredXp)} XP  •  ${Math.round(progress * 100)}%`;
    const xpTextWidth = ctx.measureText(xpText).width;
    ctx.fillText(xpText, barX + (barWidth - xpTextWidth) / 2, barY + 24);

    return canvas.toBuffer("image/png");
  },
};
