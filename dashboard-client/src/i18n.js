import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import translationFR from "./locales/fr.json";
import translationEN from "./locales/en.json";

const resources = {
  fr: { translation: translationFR },
  en: { translation: translationEN },
};

const savedLanguage = localStorage.getItem("dashboard_lang") || "fr";

i18n.use(initReactI18next).init({
  resources,
  lng: savedLanguage,
  fallbackLng: "fr",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
