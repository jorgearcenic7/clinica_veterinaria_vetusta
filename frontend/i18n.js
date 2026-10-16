(() => {
  const defaultLanguage = "es";
  const supportedLanguages = ["es", "en", "fr", "pt"];

  // Los textos viven en /i18n/<idioma>.js, que cada página carga antes que este script.
  const translations = window.VetustaTranslations || {};

  function t(key, language = getLanguage()) {
    const dictionary = translations[language] || translations[defaultLanguage] || {};
    return dictionary[key] ?? translations.en?.[key] ?? translations[defaultLanguage]?.[key] ?? "";
  }

  function getLanguage() {
    const stored = localStorage.getItem("vetusta-language");
    return supportedLanguages.includes(stored) ? stored : defaultLanguage;
  }

  function applyLanguage(language) {
    document.documentElement.lang = language;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = t(element.dataset.i18n, language);
      if (value) {
        element.textContent = value;
      }
    });

    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
      const value = t(element.dataset.i18nHtml, language);
      if (value) {
        element.innerHTML = value;
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const value = t(element.dataset.i18nPlaceholder, language);
      if (value) {
        element.setAttribute("placeholder", value);
      }
    });

    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      const value = t(element.dataset.i18nAriaLabel, language);
      if (value) {
        element.setAttribute("aria-label", value);
      }
    });

    document.dispatchEvent(new CustomEvent("vetusta:languagechange", {
      detail: { language },
    }));
  }

  function init() {
    const select = document.getElementById("language-select");
    const initialLanguage = getLanguage();

    if (select) {
      select.value = initialLanguage;

      const handleLanguageChange = () => {
        localStorage.setItem("vetusta-language", select.value);
        applyLanguage(select.value);
      };

      select.addEventListener("change", handleLanguageChange);
      select.addEventListener("input", handleLanguageChange);
    }

    applyLanguage(initialLanguage);
  }

  window.VetustaI18n = {
    getLanguage,
    t,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
