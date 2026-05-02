# Clinica Veterinaria Vetusta

Web dinamica con Express. Ahora usa resenas locales para no depender de pago en Google Cloud, y queda preparada para activar Google Places API (New) en el futuro.

## Configuracion

1. Instala Node.js 18 o superior.
2. Crea un archivo `.env`.
3. Deja `GOOGLE_ENABLE_LIVE_REVIEWS=false` para usar `reviews.local.json` sin llamadas a Google.

Las coordenadas de la clinica ya estan configuradas:

```text
GOOGLE_PLACE_LATITUDE=43.36443719850797
GOOGLE_PLACE_LONGITUDE=-5.833903884657452
```

Con esas coordenadas, cuando actives Google en el futuro, el backend buscara automaticamente el negocio cercano de tipo `veterinary_care` y usara su Place ID para pedir las resenas. Si prefieres fijarlo manualmente, anade `GOOGLE_PLACE_ID` en `.env` y se saltara la busqueda por coordenadas.

## Seguridad y limites de demo

`.env` esta ignorado por Git y no debe subirse nunca. No se incluye `.env.example` para evitar publicar plantillas de configuracion.

La clave de demostracion de Maps no esta pensada para produccion. Ahora las llamadas reales a Google estan apagadas:

```env
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
GOOGLE_ENABLE_LIVE_REVIEWS=false
```

- `REVIEWS_CACHE_TTL_SECONDS`: guarda la respuesta en memoria durante 6 horas.
- `GOOGLE_DAILY_REQUEST_LIMIT`: limite local de llamadas reales a Google por dia.
- `GOOGLE_ENABLE_LIVE_REVIEWS=false`: corta todas las llamadas reales a Google y usa `reviews.local.json`.

El contador local se guarda en `.google-usage.json`, tambien ignorado por Git.

## Activar Google Places en el futuro

1. Activa facturacion en Google Cloud.
2. Habilita Places API (New).
3. Pon una API key restringida en `.env`.
4. Cambia:

```env
GOOGLE_ENABLE_LIVE_REVIEWS=true
```

5. Reinicia el servidor.

## Ejecutar en localhost

```bash
npm install
npm run dev
```

Abre:

```text
http://127.0.0.1:3000
```

El endpoint dinamico queda disponible en:

```text
http://127.0.0.1:3000/api/google-reviews
```

La API key se lee solo desde `.env` en el backend. No se inyecta en el HTML.

## Publicar en Vercel de forma privada

El proyecto ya incluye `vercel.json` y esta preparado para desplegar `server.js` como funcion serverless en Vercel.

1. Sube los ultimos cambios a GitHub.
2. Entra en https://vercel.com/new.
3. Importa el repositorio `jorgearcenic7/clinica_veterinaria_vetusta`.
4. Framework Preset: `Other`.
5. Build Command: dejar vacio.
6. Output Directory: dejar vacio.
7. Install Command: `npm install`.
8. En Environment Variables, anade como minimo:

```env
GOOGLE_ENABLE_LIVE_REVIEWS=false
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
```

No subas `.env` a GitHub. Si en el futuro activas Google Places, anade `GOOGLE_PLACES_API_KEY` solo en las variables de entorno de Vercel.

### Privacidad

Si el repositorio es privado en GitHub, el codigo no sera publico. Eso no significa automaticamente que la URL desplegada sea privada.

Para que la web desplegada sea privada en Vercel:

- En el proyecto de Vercel, entra en Settings > Deployment Protection.
- Activa Vercel Authentication.
- En plan Hobby, Standard Protection protege previews y URLs de deployment, pero el dominio de produccion sigue siendo publico.
- Para proteger tambien produccion, necesitas All Deployments, disponible en planes Pro/Enterprise.

Mientras quieras mantenerla privada sin pagar, usa una Preview Deployment protegida y no compartas ni promociones el dominio de produccion.

## Reservas online

El formulario de reserva usa un calendario real:

- Lunes a viernes: 10:30-13:30 y 17:00-20:00.
- Sabados: 11:00-13:30.
- Domingos: cerrado.
- Huecos de 30 minutos.
- Los horarios reservados aparecen en rojo y no se pueden elegir.

Las reservas se guardan en Supabase si existen `SUPABASE_URL` y `SUPABASE_ANON_KEY` o `SUPABASE_SERVICE_ROLE_KEY` en el entorno. Si faltan esas variables, se usa `reservations.json` solo como fallback local de desarrollo.

Para crear la tabla en Supabase:

1. Abre Supabase > SQL Editor.
2. Ejecuta el contenido de `supabase-reservations.sql`.
3. En Vercel, anade estas variables:

```env
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_anon_key
```

Para produccion, es preferible usar `SUPABASE_SERVICE_ROLE_KEY` solo en el backend/Vercel y ajustar las politicas RLS.
