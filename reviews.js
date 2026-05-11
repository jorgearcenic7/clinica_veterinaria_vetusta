(async function loadGoogleReviews() {
  const ratingElement = document.querySelector("[data-google-rating]");
  const countElement = document.querySelector("[data-google-review-count]");
  const heroCopyElement = document.querySelector("[data-google-hero-copy]");
  const trustCopyElement = document.querySelector("[data-google-trust-copy]");
  const sectionSummaryElement = document.querySelector("[data-google-section-summary]");
  const reviewsListElement = document.querySelector("[data-google-reviews-list]");
  const mapsLinkElement = document.querySelector("[data-google-maps-link]");

  try {
    const response = await fetch("/api/google-reviews");

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
      sectionSummaryElement.textContent = `${formattedRating || 5}/5 en Google · ${formattedCount} reseñas`;
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
  googleLogo.src = "/google-logo.svg";
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
