window.VetustaImageSources = {
  heroHome: {
    url: "https://images.pexels.com/photos/6234633/pexels-photo-6234633.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1400&h=1200&q=85",
    alt: "Veterinario sonriente atendiendo a un perro pastor alemán en la consulta",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Hero/Home (src directo en code.html para no retrasar la imagen principal)",
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
    url: "https://images.pexels.com/photos/4032274/pexels-photo-4032274.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Mano con guante ajustando un microscopio de laboratorio para una analítica",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Análisis",
  },
  groomingService: {
    url: "https://images.pexels.com/photos/6816860/pexels-photo-6816860.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Perro durante un servicio de higiene y cuidado del manto",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Peluquería",
  },
  emergencyService: {
    url: "https://images.pexels.com/photos/5731874/pexels-photo-5731874.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Perro siendo atendido con prioridad en una consulta veterinaria",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Servicio Urgencias",
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
    url: "https://images.pexels.com/photos/21268602/pexels-photo-21268602.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=700&q=85",
    alt: "Perro mayor descansando tumbado en una acera",
    source: "Pexels",
    license: "Pexels License, uso comercial permitido",
    section: "Pack Senior",
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
