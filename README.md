# Clínica Veterinaria Vetusta

![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-ready-3FCF8E?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-deployable-000000?logo=vercel&logoColor=white)
![License: Private](https://img.shields.io/badge/License-Private-red)

Web dinámica para una clínica veterinaria en Oviedo. Incluye página pública, reservas online, reseñas, área privada de clientes, panel de administración e integraciones opcionales con Supabase, Resend, Google Calendar y Google Places.

## Funcionalidades

- Página pública con información de servicios, equipo, reseñas, contacto y mapa.
- SEO local con metadata, datos estructurados `VeterinaryCare` y `FAQPage`.
- Reserva online con calendario, horarios reales y bloqueo de huecos pasados u ocupados.
- Área privada para clientes con login, mascotas, historial y documentación.
- Panel de administración para gestionar clientes, mascotas, historiales y reservas.
- Persistencia en Supabase con Row Level Security.
- Envío opcional de copia de reserva por email mediante Resend.
- Sincronización opcional de reservas confirmadas con Google Calendar.
- Reseñas locales por defecto, con opción de activar Google Places API.

## Stack

- Node.js 18+
- Express
- Supabase
- HTML, CSS con Tailwind CDN y JavaScript vanilla
- Vercel

## Instalación Local

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
GET /api/google-reviews
GET /api/availability?month=YYYY-MM
```

## Variables De Entorno

Crea un archivo `.env` en local. No subas `.env` a GitHub.

### Base

```env
PORT=3000
CLINIC_PHONE="YOUR_PHONE"
GOOGLE_ENABLE_LIVE_REVIEWS=false
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
```

Con `GOOGLE_ENABLE_LIVE_REVIEWS=false`, la web usa reseñas locales y evita llamadas reales a Google Places.

### Supabase

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=public_anon_key
SUPABASE_SERVICE_ROLE_KEY=server_only_secret
```

Notas:

- `SUPABASE_ANON_KEY` puede exponerse al frontend siempre que RLS esté correctamente configurado.
- `SUPABASE_SERVICE_ROLE_KEY` debe usarse solo en backend o en variables de entorno del proveedor de despliegue.
- Si Supabase no está configurado, el backend puede usar un fallback local para desarrollo.

### Resend

```env
RESEND_API_KEY=your_resend_api_key
RESERVATION_FROM_EMAIL="Clinic Name <reservas@yourdomain.com>"
```

Si Resend no está configurado, las reservas se crean igualmente, pero no se envía copia por email.

### Google Places

```env
GOOGLE_ENABLE_LIVE_REVIEWS=true
GOOGLE_PLACES_API_KEY=your_google_places_api_key
GOOGLE_PLACE_LATITUDE=YOUR_LATITUDE
GOOGLE_PLACE_LONGITUDE=YOUR_LONGITUDE
GOOGLE_PLACE_SEARCH_RADIUS_METERS=80
GOOGLE_LANGUAGE_CODE=es
```

También puede fijarse manualmente el Place ID:

```env
GOOGLE_PLACE_ID=your_place_id
```

### Google Calendar

La sincronización de reservas con Google Calendar se ejecuta únicamente desde el backend.

```env
GOOGLE_CALENDAR_ID=your_calendar_id
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key
```

Antes de usar esta integración, comparte el calendario de Google con la cuenta de servicio correspondiente.

### Analytics

El proyecto deja preparado GA4 desde el backend:

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

También acepta:

```env
VITE_GA_ID=G-XXXXXXXXXX
```

Si no se define un ID, `/analytics.js` devuelve un script vacío.

## Supabase

El proyecto incluye los scripts SQL necesarios para preparar la base de datos:

- `supabase-reservations.sql`: reservas, disponibilidad, índices y políticas de acceso.
- `supabase-client-area.sql`: área privada de clientes, mascotas, historiales y documentos.

Pasos recomendados:

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta completo `supabase-reservations.sql`.
4. Ejecuta completo `supabase-client-area.sql`.
5. Configura las URLs de autenticación en Supabase Authentication.

URLs habituales para desarrollo y producción:

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/auth
http://127.0.0.1:3000/dashboard
https://your-domain.com
https://your-domain.com/auth
https://your-domain.com/dashboard
```

Para asignar permisos de administración a un usuario:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID';
```

## Reservas Online

Horarios configurados:

- Lunes a viernes: 10:30-13:30 y 17:00-20:00.
- Sábados: 11:00-13:30.
- Domingos: cerrado.
- Huecos de 30 minutos.
- Cirugía ocupa 60 minutos.

El sistema:

- Muestra días pasados como no disponibles.
- Bloquea horas pasadas del día actual.
- Marca huecos ocupados.
- Evita solapamientos.
- Revalida la fecha y hora en backend.

Zona horaria:

```text
Europe/Madrid
```

## Rutas Principales

```text
/                      Página pública
/auth                  Registro, login y recuperación de contraseña
/dashboard             Área privada del cliente
/dashboard/pets/:id    Ficha privada de mascota
/admin                 Panel de administración
```

## Despliegue En Vercel

El proyecto incluye `vercel.json` y está preparado para desplegar `server.js`.

Configuración recomendada:

- Framework Preset: `Other`
- Build Command: vacío
- Output Directory: vacío
- Install Command: `npm install`

Añade las variables necesarias en:

```text
Vercel > Project Settings > Environment Variables
```

Variables mínimas recomendadas para producción con Supabase:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=public_anon_key
SUPABASE_SERVICE_ROLE_KEY=server_only_secret
GOOGLE_ENABLE_LIVE_REVIEWS=false
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
```

## Seguridad

- No subas `.env`, claves privadas ni secretos de backend al repositorio.
- Mantén `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en entorno de servidor.
- Usa RLS en Supabase para proteger los datos privados.
- Sirve páginas privadas sin caché persistente.
- Valida reservas tanto en frontend como en backend.
- Revisa que capturas o datos de prueba no incluyan información real de clientes, mascotas o historiales médicos.

## Estructura Del Proyecto

```text
server.js                     Backend Express y APIs
code.html                     Página pública
booking.js                    Calendario y formulario de reservas
reviews.js                    Carga de reseñas
i18n.js                       Traducciones
auth.html / auth.js           Login y registro
dashboard.html / dashboard.js Área privada del cliente
pet-detail.html / pet-detail.js Ficha de mascota
admin.html / admin.js         Panel de administración
supabase-client.js            Configuración pública de Supabase
supabase-reservations.sql     SQL de reservas
supabase-client-area.sql      SQL del área privada
client-area.css               Estilos del área privada
vercel.json                   Configuración de despliegue
```

## Repositorio Público

Este repositorio no debe incluir:

- `.env`
- `.google-usage.json`
- `reservations.json` con datos reales
- claves privadas de Google
- service role keys de Supabase
- API keys de Resend o Google Places

## Licencia

Copyright (c) 2025 Clínica Veterinaria Vetusta

Todos los derechos reservados.

Este proyecto y su código fuente han sido desarrollados para Clínica Veterinaria Vetusta. Queda prohibida la reproducción, distribución, modificación o reutilización total o parcial del código, diseño, textos, imágenes o cualquier otro recurso del proyecto sin autorización previa por escrito.

## Posibles Mejoras Futuras

- Integración completa con Google Analytics 4, con eventos personalizados para llamadas, reservas y formularios.
- Configuración de Google Search Console y seguimiento periódico de cobertura, rendimiento y consultas locales.
- Evolución del sistema de gestión de citas con reglas avanzadas, reprogramación, cancelaciones y disponibilidad por profesional.
- Panel de administración para editar contenidos públicos sin tocar el código.
- Blog veterinario optimizado para SEO local con artículos sobre salud, prevención y cuidados de perros y gatos en Oviedo.
- Páginas individuales para cada servicio veterinario, como vacunación, urgencias, cirugía o peluquería.
- Optimización avanzada de Core Web Vitals, incluyendo revisión de carga de fuentes, imágenes críticas y scripts externos.
- Sistema automático de recordatorios de vacunas, revisiones y tratamientos preventivos.
- Integración con WhatsApp Business para contacto rápido, avisos y confirmaciones.
- Ampliación del área privada para clientes con más autoservicio, documentos descargables y seguimiento de citas.
- Ampliación del soporte multiidioma, especialmente español/inglés, con contenido SEO adaptado por idioma.
- Integración con CRM o herramientas de email marketing para comunicaciones segmentadas.
- Sistema dinámico de reseñas de Google con controles de caché, moderación visual y métricas de rendimiento.
- Sincronización automática de reseñas mediante Google Business Profile API si el acceso y las políticas de Google lo permiten.
