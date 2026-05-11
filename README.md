# Clínica Veterinaria Vetusta

Web dinámica para una clínica veterinaria en Oviedo. Incluye página pública, reseñas, formulario de reserva online, área privada de clientes, panel de administración, integración opcional con Supabase, envío de emails y sincronización opcional con Google Calendar.

## Funcionalidades

- Página pública responsive con información de servicios, equipo, reseñas, contacto y mapa.
- SEO local básico con metadata, JSON-LD `VeterinaryCare` y `FAQPage`.
- Reserva online con calendario, horarios reales y bloqueo de huecos pasados u ocupados.
- Área privada para clientes: login, mascotas, historial y documentación.
- Panel de administración para gestionar clientes, mascotas, historiales y reservas.
- Persistencia en Supabase con Row Level Security.
- Envío opcional de copia de reserva por email mediante Resend.
- Sincronización opcional de reservas confirmadas con Google Calendar.
- Reseñas locales por defecto, con opción futura de activar Google Places API.

## Stack

- Node.js 18+
- Express
- Supabase
- HTML, CSS con Tailwind CDN y JavaScript vanilla
- Vercel para despliegue

## Instalación local

```bash
npm install
npm run dev
```

Abre la web en:

```text
http://127.0.0.1:3000
```

Endpoints útiles:

```text
http://127.0.0.1:3000/api/google-reviews
http://127.0.0.1:3000/api/availability?month=2026-05
```

## Variables de entorno

Crea un archivo `.env` en local. No subas `.env` a GitHub.

### Mínimo recomendado para desarrollo

```env
GOOGLE_ENABLE_LIVE_REVIEWS=false
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
```

Con esta configuración, la web usa reseñas locales y no hace llamadas reales a Google Places.

### Supabase

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_publica
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_solo_backend
```

Notas:

- `SUPABASE_ANON_KEY` es pública y puede usarse en el frontend con RLS.
- `SUPABASE_SERVICE_ROLE_KEY` nunca debe ir en HTML ni JavaScript del navegador.
- Si falta Supabase, el backend puede usar `reservations.json` como fallback local de desarrollo.

### Emails con Resend

```env
RESEND_API_KEY=tu_api_key_de_resend
RESERVATION_FROM_EMAIL="Clínica Veterinaria Vetusta <reservas@tudominio.com>"
```

Si estas variables no existen, la reserva se crea igualmente, pero no se envía copia por email.

### Google Places API

Por defecto las reseñas reales están desactivadas:

```env
GOOGLE_ENABLE_LIVE_REVIEWS=false
```

Para activar Google Places en el futuro:

```env
GOOGLE_ENABLE_LIVE_REVIEWS=true
GOOGLE_PLACES_API_KEY=tu_api_key_restringida
GOOGLE_PLACE_LATITUDE=43.36443719850797
GOOGLE_PLACE_LONGITUDE=-5.833903884657452
GOOGLE_PLACE_SEARCH_RADIUS_METERS=80
GOOGLE_LANGUAGE_CODE=es
```

También puedes fijar manualmente el Place ID:

```env
GOOGLE_PLACE_ID=tu_place_id
```

### Google Calendar

La sincronización se ejecuta solo en el backend.

```env
GOOGLE_CALENDAR_ID=clinicavetusta@gmail.com
GOOGLE_CLIENT_EMAIL=service-account@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Antes de usarlo, comparte el calendario de Google con el email de la service account.

### Analytics

El proyecto ya deja preparado GA4 desde el backend:

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

También acepta:

```env
VITE_GA_ID=G-XXXXXXXXXX
```

Si no hay ID, `/analytics.js` devuelve un script vacío.

### Otras variables

```env
PORT=3000
CLINIC_PHONE="985 20 65 58"
```

## Base de datos Supabase

Hay dos archivos SQL principales:

- `supabase-reservations.sql`: tabla de reservas, índices, políticas RLS y función de disponibilidad pública.
- `supabase-client-area.sql`: perfiles, mascotas, historiales, documentos, storage privado y políticas RLS del área privada.

Para configurar Supabase:

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta completo `supabase-reservations.sql`.
4. Ejecuta completo `supabase-client-area.sql`.
5. En Authentication > URL Configuration, añade tus URLs locales y de producción.

Ejemplos de URLs:

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/auth
http://127.0.0.1:3000/dashboard
https://tu-dominio.com
https://tu-dominio.com/auth
https://tu-dominio.com/dashboard
```

Para convertir una cuenta en admin:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID_DEL_USUARIO';
```

Puedes encontrar el UUID en Supabase > Authentication > Users.

## Reservas online

Horarios configurados:

- Lunes a viernes: 10:30-13:30 y 17:00-20:00.
- Sábados: 11:00-13:30.
- Domingos: cerrado.
- Huecos de 30 minutos.
- Cirugía ocupa 60 minutos.

El calendario:

- Muestra días pasados como no disponibles.
- Bloquea horas pasadas del día actual.
- Marca huecos ocupados.
- Evita solapamientos.
- Revalida la fecha y hora también en el backend.

Zona horaria usada para reservas y Google Calendar:

```text
Europe/Madrid
```

## Rutas principales

```text
/                      Página pública
/auth                  Registro, login y recuperación de contraseña
/dashboard             Área privada del cliente
/dashboard/pets/:id    Ficha privada de mascota
/admin                 Panel de administración
```

## Despliegue en Vercel

El proyecto incluye `vercel.json` y está preparado para desplegar `server.js`.

Configuración recomendada:

- Framework Preset: `Other`
- Build Command: vacío
- Output Directory: vacío
- Install Command: `npm install`

Después añade las variables de entorno necesarias en:

```text
Vercel > Project Settings > Environment Variables
```

Variables mínimas para producción con Supabase:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=tu_anon_key_publica
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_solo_backend
GOOGLE_ENABLE_LIVE_REVIEWS=false
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
```

## Seguridad

- No subas `.env`, claves privadas ni service role keys a GitHub.
- Usa `SUPABASE_SERVICE_ROLE_KEY` solo en backend/Vercel.
- El frontend recibe únicamente `SUPABASE_ANON_KEY`.
- Las tablas privadas usan Row Level Security.
- Las páginas privadas se sirven con `Cache-Control: no-store`.
- Los buckets `pet-images` y `pet-documents` son privados.
- Los documentos se sirven mediante URLs firmadas.
- El registro exige contraseña fuerte.
- Los cambios de rol están protegidos por trigger en Supabase.
- Las reservas se validan en frontend y backend.

## Archivos importantes

```text
server.js                    Backend Express y APIs
code.html                    Página pública
booking.js                   Calendario y formulario de reservas
reviews.js                   Carga de reseñas
i18n.js                      Traducciones
auth.html / auth.js          Login y registro
dashboard.html / dashboard.js Área privada del cliente
admin.html / admin.js        Panel de administración
supabase-client.js           Configuración pública de Supabase
supabase-reservations.sql    SQL de reservas
supabase-client-area.sql     SQL del área privada
client-area.css              Estilos del área privada
vercel.json                  Configuración de despliegue
```

## Notas para repositorio público

Este repositorio no debe incluir:

- `.env`
- `.google-usage.json`
- `reservations.json` con datos reales
- claves privadas de Google
- service role keys de Supabase
- API keys de Resend o Google Places

Si publicas capturas o datos de prueba, revisa que no contengan nombres, teléfonos, emails ni información médica real.

## Licencia

Proyecto desarrollado para Clínica Veterinaria Vetusta. Añade aquí la licencia que quieras aplicar antes de publicar el repositorio.
