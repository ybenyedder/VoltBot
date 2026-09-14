// Regex de détection de liens partagée entre l'automod (messageCreate) et
// messageUpdate. Source unique pour garantir un comportement identique :
// c'est la version de l'automodHandler (la plus stricte) qui fait foi, afin
// d'éviter tout contournement de l'anti-link par simple édition de message.
// NB : on exporte une factory car une regex munie du flag "g" conserve un
// état `lastIndex` entre deux `.test()` sur une même instance.
const LINK_REGEX_SOURCE =
  "(https?:\\/\\/[^\\s]+|bit\\.ly\\/[^\\s]+|[a-zA-Z0-9-]+\\.[a-z]{2,})";

const createLinkRegex = () => new RegExp(LINK_REGEX_SOURCE, "gi");

module.exports = { LINK_REGEX_SOURCE, createLinkRegex };
