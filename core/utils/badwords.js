function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMatcher(rawWord) {
  const original = String(rawWord || "").trim();
  const normalized = normalizeText(original).replace(/\s+/g, "").trim();
  if (!normalized) return null;

  const pattern = normalized.split("").map(escapeRegex).join("[\\s\\W_]+");

  return {
    word: original,
    normalized,
    regex: new RegExp(
      `(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`,
      "iu",
    ),
  };
}

function buildMatchers(rows) {
  return (rows || [])
    .map((row) => buildMatcher(row.word || row))
    .filter(Boolean);
}

function findBadword(content, rowsOrMatchers) {
  const normalizedContent = normalizeText(content);
  const matchers = rowsOrMatchers?.[0]?.regex
    ? rowsOrMatchers
    : buildMatchers(rowsOrMatchers);
  return matchers.find(({ regex }) => regex.test(normalizedContent)) || null;
}

module.exports = {
  normalizeText,
  buildMatchers,
  findBadword,
};
