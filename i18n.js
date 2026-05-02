(() => {
  const defaultLanguage = "es";
  const supportedLanguages = ["es", "en", "fr", "pt"];

  const translations = {
    es: {
      "nav.home": "Inicio",
      "nav.services": "Servicios",
      "nav.team": "Equipo",
      "nav.reviews": "Opiniones",
      "nav.contact": "Contacto",
      "nav.clientArea": "Area clientes",
      "nav.appointment": "Pedir cita · 985 20 65 58",
      "hero.title": "Tu mascota merece lo mejor. Y en Vetusta lo sabe.",
      "hero.prefix": "Clínica veterinaria en Oviedo con",
      "hero.reviewCopy": "más de 560 opiniones de 5 estrellas",
      "hero.suffix": "Trato humano, honesto y a precios justos.",
      "hero.call": "Llámanos ahora",
      "hero.services": "Ver servicios",
    },
    en: {
      "nav.home": "Home",
      "nav.services": "Services",
      "nav.team": "Team",
      "nav.reviews": "Reviews",
      "nav.contact": "Contact",
      "nav.clientArea": "Client area",
      "nav.appointment": "Book appointment · 985 20 65 58",
      "hero.title": "Your pet deserves the best. Vetusta knows it.",
      "hero.prefix": "Veterinary clinic in Oviedo with",
      "hero.reviewCopy": "more than 560 five-star reviews",
      "hero.suffix": "Kind, honest care at fair prices.",
      "hero.call": "Call us now",
      "hero.services": "View services",
    },
    fr: {
      "nav.home": "Accueil",
      "nav.services": "Services",
      "nav.team": "Équipe",
      "nav.reviews": "Avis",
      "nav.contact": "Contact",
      "nav.clientArea": "Espace client",
      "nav.appointment": "Prendre rendez-vous · 985 20 65 58",
      "hero.title": "Votre animal mérite le meilleur. Vetusta le sait.",
      "hero.prefix": "Clinique vétérinaire à Oviedo avec",
      "hero.reviewCopy": "plus de 560 avis cinq étoiles",
      "hero.suffix": "Un accompagnement humain, honnête et à prix justes.",
      "hero.call": "Appelez-nous",
      "hero.services": "Voir les services",
    },
    pt: {
      "nav.home": "Início",
      "nav.services": "Serviços",
      "nav.team": "Equipa",
      "nav.reviews": "Opiniões",
      "nav.contact": "Contacto",
      "nav.clientArea": "Área de clientes",
      "nav.appointment": "Marcar consulta · 985 20 65 58",
      "hero.title": "O seu animal merece o melhor. A Vetusta sabe disso.",
      "hero.prefix": "Clínica veterinária em Oviedo com",
      "hero.reviewCopy": "mais de 560 avaliações de cinco estrelas",
      "hero.suffix": "Atendimento humano, honesto e a preços justos.",
      "hero.call": "Ligue agora",
      "hero.services": "Ver serviços",
    },
  };

  function getLanguage() {
    const stored = localStorage.getItem("vetusta-language");
    return supportedLanguages.includes(stored) ? stored : defaultLanguage;
  }

  function applyLanguage(language) {
    const dictionary = translations[language] || translations[defaultLanguage];
    document.documentElement.lang = language;

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (dictionary[key]) {
        element.textContent = dictionary[key];
      }
    });

    const reviewCopy = document.querySelector("[data-google-hero-copy]");
    if (reviewCopy) {
      reviewCopy.dataset.i18n = "hero.reviewCopy";
      reviewCopy.textContent = dictionary["hero.reviewCopy"];
    }
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

    const reviewCopy = document.querySelector("[data-google-hero-copy]");
    if (reviewCopy) {
      const observer = new MutationObserver(() => {
        const language = getLanguage();
        const expected = translations[language]["hero.reviewCopy"];
        if (language !== defaultLanguage && reviewCopy.textContent !== expected) {
          reviewCopy.textContent = expected;
        }
      });

      observer.observe(reviewCopy, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
