// Localisation des noms d'items économie POUR L'AFFICHAGE uniquement.
// La valeur française reste la clé canonique stockée en base (inventaire,
// boutique). On ne traduit que ce qui est montré à l'utilisateur ; les
// lookups DB continuent d'utiliser le nom français d'origine.
//
// localizeItemName(storedFrenchName, lang) -> nom affichable
// localizeItemDesc(frenchDesc, lang)       -> description affichable

const NAME_EN = {
  // Pêche (fish.js)
  "Poisson commun": "Common Fish",
  Saumon: "Salmon",
  "Poisson Tropical": "Tropical Fish",
  Requin: "Shark",
  "Coffre Trésor": "Treasure Chest",
  // Minage (mine.js)
  Pierre: "Stone",
  Charbon: "Coal",
  Fer: "Iron",
  Or: "Gold",
  Diamant: "Diamond",
  // Boutique / inventaire (buy.js, inventory.js)
  "Rôle VIP": "VIP Role",
  Cadenas: "Padlock",
  "Trèfle à quatre feuilles": "Four-leaf Clover",
};

const DESC_EN = {
  "Accès exclusif aux salons secrets.": "Exclusive access to secret channels.",
  "Protège votre porte-monnaie d'un braquage.":
    "Protects your wallet from a robbery.",
};

const localizeItemName = (name, lang) =>
  lang === "en" && NAME_EN[name] ? NAME_EN[name] : name;

const localizeItemDesc = (desc, lang) =>
  lang === "en" && DESC_EN[desc] ? DESC_EN[desc] : desc;

module.exports = { localizeItemName, localizeItemDesc, NAME_EN, DESC_EN };
