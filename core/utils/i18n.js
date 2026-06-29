const fs = require("fs");
const path = require("path");
const Logger = require("./logger");

const locales = {};

const loadLocales = () => {
  try {
    const localesPath = path.join(__dirname, "../locales");
    if (fs.existsSync(localesPath)) {
      const files = fs
        .readdirSync(localesPath)
        .filter((f) => f.endsWith(".json"));
      for (const file of files) {
        const lang = file.replace(".json", "");
        const content = fs.readFileSync(path.join(localesPath, file), "utf-8");
        locales[lang] = JSON.parse(content);
      }
      Logger.info(`[I18N] Loaded locales: ${Object.keys(locales).join(",")}`);
    }
  } catch (error) {
    Logger.error("[I18N] Error loading locales:", error);
  }
};

loadLocales();

/**
 * Gets a translated string
 * @param {string} lang - The language code (fr, en)
 * @param {string} key - The translation key (e.g. 'commands.clear.success')
 * @param {object} variables - Variables to inject (e.g. { count: 5 })
 * @returns {string} The translated string
 */
const resolveKey = (localeRoot, keys) => {
  let value = localeRoot;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }
  return value;
};

const t = (lang, key, variables = {}) => {
  const keys = key.split(".");

  // Fallback chain: requested lang -> fr -> en -> key
  const chain = [lang, "fr", "en"].filter(
    (l, i, arr) => l && arr.indexOf(l) === i && locales[l],
  );

  let value;
  for (const l of chain) {
    const resolved = resolveKey(locales[l], keys);
    if (typeof resolved === "string" || typeof resolved === "number") {
      value = resolved;
      break;
    }
  }

  if (typeof value !== "string" && typeof value !== "number") return key;

  return String(value).replace(/\{\{(\w+)\}\}/g, (match, v) => {
    return variables[v] !== undefined ? variables[v] : match;
  });
};

module.exports = { t, loadLocales, locales };
