// Solo se muestran cifras y reseñas que llegan de Google. Sin datos, el badge
// de la franja y la reseña destacada siguen ocultos y la sección enseña
// únicamente el enlace a Google.
(async function loadGoogleReviews() {
  // Dentro de la IIFE: booking.js también declara localeByLanguage en el ámbito global.
  const localeByLanguage = { es: "es-ES", en: "en-GB", fr: "fr-FR", pt: "pt-PT" };
  const translateTemplate = (key, values, fallback) => {
    const template = window.VetustaI18n?.t(key) || fallback;
    return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
  };

  const badgeElement = document.querySelector("[data-google-badge]");
  const ratingElement = document.querySelector("[data-google-rating]");
  const countElement = document.querySelector("[data-google-review-count]");
  const sectionSummaryElement = document.querySelector("[data-google-section-summary]");
  const mapsLinkElement = document.querySelector("[data-google-maps-link]");

  try {
    const { fetchGoogleReviews } = await import("/modules/shared/api.js");
    const response = await fetchGoogleReviews();

    if (!response.ok) {
      throw new Error("Google reviews endpoint failed");
    }

    const data = await response.json();
    const rating = typeof data.rating === "number" ? data.rating : null;
    const reviewCount = Number(data.reviewCount || 0);

    const renderSummary = () => {
      if (!rating || !reviewCount) {
        return;
      }

      const locale = localeByLanguage[window.VetustaI18n?.getLanguage()] || localeByLanguage.es;
      const values = {
        rating: rating.toLocaleString(locale, { maximumFractionDigits: 1 }),
        count: reviewCount.toLocaleString(locale),
      };

      if (ratingElement) {
        ratingElement.textContent = `⭐ ${values.rating}/5`;
      }

      if (countElement) {
        countElement.textContent = translateTemplate("hero.reviewCount", values, "· {count} reseñas en Google");
      }

      if (sectionSummaryElement) {
        sectionSummaryElement.textContent = translateTemplate("reviews.summary", values, "{rating}/5 en Google · {count} reseñas");
      }

      badgeElement?.classList.remove("hidden");
    };

    renderSummary();
    document.addEventListener("vetusta:languagechange", renderSummary);

    if (data.googleMapsUri && mapsLinkElement) {
      mapsLinkElement.href = data.googleMapsUri;
    }

    const featuredReview = Array.isArray(data.reviews) ? data.reviews.find((review) => review?.text) : null;
    if (featuredReview) {
      renderFeaturedReview(featuredReview);
    }
  } catch (error) {
    console.warn("No se pudieron actualizar las reseñas de Google.", error);
  }
})();

function renderFeaturedReview(review) {
  const container = document.querySelector("[data-google-featured-review]");
  const starsElement = container?.querySelector("[data-google-featured-stars]");
  const textElement = container?.querySelector("[data-google-featured-text]");
  const authorElement = container?.querySelector("[data-google-featured-author]");

  if (!container || !textElement || !authorElement) {
    return;
  }

  const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating || 0))));

  if (starsElement) {
    starsElement.setAttribute("aria-label", `${rating}/5`);
    starsElement.replaceChildren(...Array.from({ length: 5 }, (_, index) => {
      const star = document.createElement("span");
      star.className = "material-symbols-outlined text-[22px]";
      star.setAttribute("aria-hidden", "true");
      star.style.fontVariationSettings = "'FILL' 1";
      star.textContent = index < rating ? "star" : "star_outline";
      return star;
    }));
  }

  textElement.textContent = `“${review.text}”`;
  authorElement.textContent = review.relativeTime ? `${review.author} · ${review.relativeTime}` : review.author;

  if (review.authorUrl) {
    authorElement.href = review.authorUrl;
  }

  container.classList.remove("hidden");
}
