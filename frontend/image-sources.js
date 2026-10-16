window.VetustaImageSources = {
  heroHome: {
    url: "https://images.pexels.com/photos/6234633/pexels-photo-6234633.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1400&h=1200&q=85",
    alt: "Veterinario sonriente atendiendo a un perro pastor alemán en la consulta",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Hero/Home (src directo en code.html para no retrasar la imagen principal)",
  },
  teamPatricia: {
    url: "https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=1125&q=85",
    alt: "Foto temporal de una veterinaria de stock",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Equipo",
  },
  teamVictor: {
    url: "https://images.pexels.com/photos/6235652/pexels-photo-6235652.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=1125&q=85",
    alt: "Foto temporal de stock: veterinario con un pomerania en brazos",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Equipo",
  },
  authPortal: {
    url: "https://images.pexels.com/photos/5731866/pexels-photo-5731866.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=1500&q=85",
    alt: "Mascota tranquila en un entorno de atención veterinaria",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Área privada",
  },
};

document.documentElement.style.setProperty("--image-auth-portal", `url("${window.VetustaImageSources.authPortal.url}")`);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-image-source]").forEach((image) => {
    const source = window.VetustaImageSources[image.dataset.imageSource];

    if (!source) {
      return;
    }

    image.src = source.url;
    image.alt = source.alt;
  });
});
