const googleLogoSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath fill='%23FFC107' d='M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z'/%3E%3Cpath fill='%23FF3D00' d='M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.2 4 9.5 8.5 6.3 14.7z'/%3E%3Cpath fill='%234CAF50' d='M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2C29.3 35.1 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.4 39.6 16.1 44 24 44z'/%3E%3Cpath fill='%231976D2' d='M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.3 4.3-4.1 5.6l6.2 5.2C36.9 39.3 44 34 44 24c0-1.3-.1-2.4-.4-3.5z'/%3E%3C/svg%3E";

(async function loadGoogleReviews() {
  const ratingElement = document.querySelector("[data-google-rating]");
  const countElement = document.querySelector("[data-google-review-count]");
  const heroCopyElement = document.querySelector("[data-google-hero-copy]");
  const trustCopyElement = document.querySelector("[data-google-trust-copy]");
  const sectionSummaryElement = document.querySelector("[data-google-section-summary]");
  const reviewsListElement = document.querySelector("[data-google-reviews-list]");
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
    const formattedRating = rating ? rating.toLocaleString("es-ES", { maximumFractionDigits: 1 }) : null;
    const formattedCount = reviewCount.toLocaleString("es-ES");

    if (formattedRating && ratingElement) {
      ratingElement.textContent = `⭐ ${formattedRating}/5`;
    }

    if (reviewCount && countElement) {
      countElement.textContent = `· +${formattedCount} reseñas en Google`;
    }

    if (reviewCount && heroCopyElement) {
      heroCopyElement.textContent = `más de ${formattedCount} opiniones de ${formattedRating || 5} estrellas`;
    }

    if (reviewCount && trustCopyElement) {
      trustCopyElement.textContent = `Más de ${formattedCount} reseñas ${formattedRating || 5} estrellas`;
    }

    if (reviewCount && sectionSummaryElement) {
      sectionSummaryElement.textContent = `${formattedRating || 5}/5 en Google · ${formattedCount} reseñas · datos recopilados en la última actualización`;
    }

    if (data.googleMapsUri && mapsLinkElement) {
      mapsLinkElement.href = data.googleMapsUri;
    }

    if (reviewsListElement && Array.isArray(data.reviews) && data.reviews.length > 0) {
      reviewsListElement.replaceChildren(...data.reviews.map(createReviewCard));
    }
  } catch (error) {
    console.warn("No se pudieron actualizar las reseñas de Google.", error);
  }
})();

function createReviewCard(review) {
  const card = document.createElement("div");
  card.className = "bg-surface-container-lowest p-6 rounded-xl border border-outline-variant soft-shadow flex flex-col gap-4";

  const stars = document.createElement("div");
  stars.className = "flex items-center gap-1 text-[#D4AF37]";
  const rating = Math.max(0, Math.min(5, Math.round(Number(review.rating || 0))));

  for (let index = 0; index < 5; index += 1) {
    const star = document.createElement("span");
    star.className = "material-symbols-outlined";
    star.style.fontVariationSettings = "'FILL' 1";
    star.textContent = index < rating ? "star" : "star_outline";
    stars.append(star);
  }

  const source = document.createElement("div");
  source.className = "flex flex-wrap items-center justify-between gap-4";

  const sourceBrand = document.createElement("div");
  sourceBrand.className = "flex items-center gap-3";

  const googleLogo = document.createElement("img");
  googleLogo.src = googleLogoSrc;
  googleLogo.alt = "Google";
  googleLogo.loading = "lazy";
  googleLogo.className = "h-7 w-7 shrink-0";

  const sourceText = document.createElement("span");
  sourceText.className = "font-label-caps text-label-caps text-on-surface-variant";
  sourceText.dataset.i18n = "reviews.googleReview";
  sourceText.textContent = window.VetustaI18n?.t("reviews.googleReview") || "Reseña de Google";

  sourceBrand.append(googleLogo, sourceText);
  source.append(sourceBrand, stars);

  const text = document.createElement("p");
  text.className = "font-body-md text-body-md text-on-surface-variant flex-grow italic";
  text.textContent = `“${review.text}”`;

  const footer = document.createElement("div");
  footer.className = "flex items-center gap-3 mt-2";

  const initials = document.createElement("div");
  initials.className = "w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center font-bold text-on-surface-variant";
  initials.textContent = getInitials(review.author);

  const author = document.createElement(review.authorUrl ? "a" : "p");
  author.className = "font-label-caps text-label-caps text-on-background";
  author.textContent = review.relativeTime ? `${review.author} · ${review.relativeTime}` : review.author;

  if (review.authorUrl) {
    author.href = review.authorUrl;
    author.target = "_blank";
    author.rel = "noopener noreferrer";
  }

  footer.append(initials, author);
  card.append(source, text, footer);

  return card;
}

function getInitials(name) {
  return String(name || "Google")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
