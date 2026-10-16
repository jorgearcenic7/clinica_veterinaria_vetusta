# CLAUDE.md

Web de la Clínica Veterinaria Vetusta (Oviedo): Express + HTML/JS vanilla + Supabase, desplegada en Vercel. La estructura completa y las variables de entorno están en `README.md`; aquí solo lo que no se deduce leyendo el código.

## Comandos

- `npm run dev` — servidor con recarga en `http://127.0.0.1:3000` (necesita `.env`, ver `.env.example`).
- `npm run build:css` — recompila `frontend/public/tailwind.css`. Hazlo tras añadir clases Tailwind nuevas en HTML/JS: el CSS compilado está versionado y Vercel lo regenera en el build.
- `npm test` (Vitest) y `npm run type-check` (tsc). CI ejecuta ambos en cada PR.
- Detrás del proxy corporativo: `npm install --strict-ssl=false`. En esa red las llamadas de Node a Supabase y Google fallan con `fetch failed`; no es un bug del código.

## Convenciones

- **Textos visibles**: van en `frontend/i18n.js` en los 4 idiomas (`es`, `en`, `fr`, `pt`) y se enlazan con `data-i18n`. Las cadenas con datos usan plantillas `{nombre}` que rellena el JS.
- **Errores**: el backend solo devuelve `error.message` al cliente si es un error de validación (4xx con `statusCode`). Los 5xx se registran con `console.error` y responden un mensaje genérico. El frontend nunca muestra detalles técnicos: ofrece llamar al 985 20 65 58.
- **Reseñas y valoraciones**: solo datos reales de Google Places. No escribas reseñas, cifras de valoración ni número de reseñas fijas en HTML, i18n ni JSON (es publicidad engañosa). Sin datos, la sección muestra solo el enlace a Google.
- **Imágenes**: todas se registran en `frontend/image-sources.js` (URL, `alt`, licencia). Comprueba que la foto corresponde al texto: las del equipo son de stock temporal hasta tener fotos reales.
- **Contacto**: teléfono y WhatsApp `+34 985 20 65 58` (`wa.me/34985206558`).
- **Diseño**: tokens en `DESIGN.md` y `tailwind.config.js`.

## Tests

Los tests usan fechas fijas de 2027 (`2027-01-04` es lunes y `2027-01-10` domingo). Cuando esas fechas pasen a ser pasadas, muévelas a fechas futuras.
