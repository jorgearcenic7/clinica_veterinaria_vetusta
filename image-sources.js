window.VetustaImageSources = {
  heroHome: {
    url: "https://images.pexels.com/photos/6234626/pexels-photo-6234626.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=2400&h=1600&q=90",
    alt: "Veterinaria atendiendo a un perro en consulta",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Hero/Home",
  },
  servicesOverview: {
    url: "https://images.pexels.com/photos/6235233/pexels-photo-6235233.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1800&h=900&q=85",
    alt: "Veterinario revisando a un perro durante una consulta",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicios veterinarios",
  },
  premiumPacks: {
    url: "https://images.pexels.com/photos/6234608/pexels-photo-6234608.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1800&h=900&q=85",
    alt: "Perro durante un cuidado veterinario premium",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Packs veterinarios",
  },
  puppyPack: {
    url: "https://images.pexels.com/photos/1390361/pexels-photo-1390361.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Cachorro joven recibiendo cuidados y primeras revisiones veterinarias",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Pack Cachorro",
  },
  adultPack: {
    url: "https://images.pexels.com/photos/5731866/pexels-photo-5731866.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Mascota adulta sana preparada para una revisión veterinaria",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Pack Adulto",
  },
  seniorPack: {
    url: "https://images.pexels.com/photos/5745228/pexels-photo-5745228.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Mascota senior descansando con aspecto tranquilo",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Pack Senior",
  },
  groomingPack: {
    url: "https://images.pexels.com/photos/6816860/pexels-photo-6816860.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Perro durante un servicio de higiene y cuidado del manto",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Pack Higiene",
  },
  consultationService: {
    url: "https://images.pexels.com/photos/7470754/pexels-photo-7470754.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Veterinarios realizando una revisión general a un perro en consulta",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Consulta",
  },
  vaccinationService: {
    url: "https://images.pexels.com/photos/6235663/pexels-photo-6235663.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Mascota recibiendo cuidado preventivo y vacunación veterinaria",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Vacunación",
  },
  surgeryService: {
    url: "https://images.pexels.com/photos/23692685/pexels-photo-23692685.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Veterinaria atendiendo a un perro Chow Chow en clínica",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Cirugía",
  },
  diagnosticsService: {
    url: "https://images.pexels.com/photos/3786126/pexels-photo-3786126.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Material de diagnóstico veterinario para analíticas",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Diagnóstico",
  },
  emergencyService: {
    url: "https://images.pexels.com/photos/5731874/pexels-photo-5731874.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Perro siendo atendido con prioridad en una consulta veterinaria",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Urgencias",
  },
  teamPatricia: {
    url: "https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=1125&q=85",
    alt: "Foto temporal de una veterinaria de stock",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Equipo",
  },
  teamVictor: {
    url: "https://images.pexels.com/photos/6234605/pexels-photo-6234605.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=1125&q=85",
    alt: "Foto temporal de un veterinario de stock",
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

document.documentElement.style.setProperty("--image-hero-home", `url("${window.VetustaImageSources.heroHome.url}")`);
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
