# Clinica Veterinaria Vetusta

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-Backend-black)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E)
![Vercel](https://img.shields.io/badge/Vercel-Ready-black)
![License](https://img.shields.io/badge/License-Private-red)

Sitio web fullstack para una clinica veterinaria en Oviedo. El proyecto combina una pagina publica orientada a captacion y SEO local con reserva online, area privada de clientes, gestion de mascotas, documentacion clinica y panel de administracion.

Esta desarrollado con HTML, CSS, JavaScript vanilla y un backend Express en Node.js. Supabase se utiliza para autenticacion, persistencia, seguridad por Row Level Security y almacenamiento privado de imagenes y documentos. El backend tambien deja preparadas integraciones opcionales con Google Places, Google Calendar, Resend y Google Analytics 4.

## Funcionalidades

- Pagina publica con servicios, equipo, reseñas, contacto, mapa, preguntas frecuentes y llamadas a la accion.
- SEO local con metadatos, sitemap, robots.txt y datos estructurados para clinica veterinaria y FAQ.
- Sistema de reservas online con calendario, horarios reales, bloqueo de huecos no disponibles y validacion en servidor.
- Area privada de clientes con registro, login, recuperacion de contraseña y acceso a informacion de sus mascotas.
- Ficha privada de mascota con imagen, datos principales, historial, proximas actuaciones y documentos.
- Subida controlada de imagenes y documentos mediante buckets privados de Supabase Storage.
- Panel de administracion para consultar clientes, mascotas, historiales, documentos y reservas.
- Gestion de estado de reservas desde administracion, con soporte para reservas confirmadas y canceladas.
- Reseñas locales por defecto y opcion de activar reseñas reales desde Google Places API con cache y limite diario.
- Envio opcional de copia de reserva por email mediante Resend.
- Sincronizacion opcional de reservas confirmadas con Google Calendar mediante cuenta de servicio.
- Script dinamico de GA4 servido desde backend cuando existe un identificador configurado.
- Paginas legales incluidas: aviso legal, privacidad, politica de privacidad, cookies, terminos y condiciones de uso.

## Mejoras De UI/UX

### Navegacion

- Menu de navegacion mobile completo con drawer lateral deslizante, overlay oscuro y cierre con Escape o click fuera.
- La hamburguesa respeta el estado `aria-expanded` y bloquea el scroll del body mientras el drawer esta abierto.
- Los enlaces del menu mobile usan `data-i18n` y responden automaticamente al cambio de idioma.

### Animaciones y microinteracciones

- Animacion de entrada escalonada en secciones al hacer scroll mediante `IntersectionObserver` (fade + translateY).
- Las cards de opiniones y de "Por que elegirnos" aparecen con delay escalonado (0 / 100 / 200 ms).
- FAQ con animacion suave de apertura y cierre (`max-height` + `opacity`), sin afectar a los acordeones de packs.
- Respeto de `prefers-reduced-motion` en todas las animaciones de scroll.

### Formulario de reservas

- Spinner animado en el area de estado mientras se carga la disponibilidad o se confirma la reserva.
- Boton de envio desactivado durante la peticion y reactivado al finalizar (exito o error).
- Campos requeridos invalidos muestran borde rojo y fondo rosado mediante `:user-invalid`.

### Area privada (auth, dashboard, ficha de mascota)

- Paginas del area privada con animacion de entrada al cargar (`auth-fade-in`, `shell-fade-in`).
- Spinner en los botones de login, registro y recuperacion de contraseña durante el envio del formulario.
- Reactivacion automatica del boton al detectar un error, con failsafe de 10 segundos.
- Icono de marca (SVG de pata) anadido al topbar de dashboard y ficha de mascota para coherencia visual.
- Hover lift y sombra en botones primarios, secundarios y de peligro con transiciones de 160 ms.
- Focus ring verde en inputs, selects y textareas del area privada.
- Hover en tarjetas de mascotas (escala de foto), clientes (lift + fondo verde) y reservas (lift + borde verde).
- Radio de esquinas aumentado de 8 px a 12 px en botones e inputs del area privada.

## Stack Tecnico

- Node.js 18+
- Express 4
- Supabase JS 2
- Supabase Auth, Postgres, RLS y Storage
- Express Rate Limit
- Dotenv
- HTML, CSS y JavaScript vanilla
- Tailwind CSS 3 (build compilado, no CDN)
- Vitest para tests unitarios
- TypeScript (solo `tsc --noEmit` sobre `.d.ts` y el cliente API compartido, sin build)
- Vercel como despliegue recomendado

## Instalacion Local

Instala dependencias:

```bash
npm install
```

Copia el archivo de entorno y completa las variables necesarias:

```bash
cp .env.example .env
```

Compila el CSS de Tailwind (obligatorio antes del primer arranque):

```bash
npm run build:css
```

Inicia el servidor en modo desarrollo:

```bash
npm run dev
```

La aplicacion queda disponible en:

```text
http://127.0.0.1:3000
```

Tambien se puede ejecutar en modo normal:

```bash
npm start
```

## Scripts

```text
npm start              Ejecuta el servidor (dotenv cargado antes de todo import)
npm run dev            Ejecuta con recarga automatica mediante node --watch
npm run build:css      Compila Tailwind a public/tailwind.css (necesario antes del primer uso)
npm run build:css:watch  Compila Tailwind en modo observador (para desarrollo)
npm test               Ejecuta la suite de tests unitarios con Vitest
npm run test:watch     Ejecuta tests en modo observador
npm run type-check     Verifica tipos con tsc (noEmit, sobre types/ y el cliente API compartido)
```

El servidor arranca con `node --import ./backend/load-env.js` para garantizar que dotenv carga las variables de entorno antes de que cualquier modulo de la aplicacion se inicialice.

## Variables De Entorno

El proyecto funciona por capas. Para desarrollo basico se puede trabajar con reseñas locales y reservas en archivo temporal/local. Para produccion se recomienda configurar Supabase y las integraciones necesarias.

### Base

```env
PORT=3000
CLINIC_PHONE="YOUR_PHONE"
API_RATE_LIMIT=300
SENSITIVE_RATE_LIMIT=30
AUTH_RATE_LIMIT=10
```

`AUTH_RATE_LIMIT` recomendado:

- **Produccion: `10`** (valor estricto; es tambien el fallback del codigo si la variable no esta definida).
- **Desarrollo local: `100`** para no bloquearte al probar el panel admin repetidamente. `.env.example` ya trae `AUTH_RATE_LIMIT=100` con este proposito — si despliegas copiando ese archivo a un entorno de produccion, cambia este valor a `10` antes de subirlo.

### Supabase

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=public_anon_key
SUPABASE_SERVICE_ROLE_KEY=server_only_secret
```

Notas importantes:

- `SUPABASE_ANON_KEY` se expone al frontend mediante `/api/supabase-config`.
- `SUPABASE_SERVICE_ROLE_KEY` debe mantenerse solo en entorno de servidor.
- Las politicas RLS incluidas en los SQL son parte esencial de la seguridad del area privada.
- Si Supabase no esta configurado, las reservas pueden usar fallback local para desarrollo.

### Reseñas De Google

```env
GOOGLE_ENABLE_LIVE_REVIEWS=false
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
GOOGLE_PLACES_API_KEY=your_google_places_api_key
GOOGLE_PLACE_ID=your_place_id
GOOGLE_PLACE_LATITUDE=YOUR_LATITUDE
GOOGLE_PLACE_LONGITUDE=YOUR_LONGITUDE
GOOGLE_PLACE_SEARCH_RADIUS_METERS=80
GOOGLE_LANGUAGE_CODE=es
```

Con `GOOGLE_ENABLE_LIVE_REVIEWS=false`, el backend usa `reviews.local.json` y evita llamadas reales a Google Places.

### Email De Reservas

```env
RESEND_API_KEY=your_resend_api_key
RESERVATION_FROM_EMAIL="Clinic Name <reservas@yourdomain.com>"
```

Si Resend no esta configurado, la reserva se crea igualmente, pero no se envia copia por email.

### Google Calendar

```env
GOOGLE_CALENDAR_ID=your_calendar_id
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key
```

Para activar esta integracion, el calendario debe estar compartido con la cuenta de servicio configurada.

### Analytics

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
VITE_GA_ID=G-XXXXXXXXXX
```

Si no se define ningun identificador, `/analytics.js` devuelve un script vacio.

## Base De Datos

El repositorio incluye tres scripts SQL principales:

- `supabase-reservations.sql`: tabla de reservas, indices, estados, funciones de disponibilidad y vinculacion con perfiles.
- `supabase-client-area.sql`: perfiles, mascotas, historiales, documentos, logs de subida, buckets privados y politicas RLS. Define tambien `public.is_admin()`, reutilizada por el script de auditoria.
- `supabase-audit-log.sql`: tabla `admin_audit_logs` para la auditoria de acciones administrativas sobre reservas. Requiere haber ejecutado antes `supabase-client-area.sql`.

Pasos recomendados:

1. Crear un proyecto en Supabase.
2. Abrir SQL Editor.
3. Ejecutar `supabase-reservations.sql`.
4. Ejecutar `supabase-client-area.sql`.
5. Ejecutar `supabase-audit-log.sql`.
6. Revisar las politicas RLS y buckets `pet-images` y `pet-documents`.
7. Configurar las URLs de autenticacion permitidas.

### Auditoria de acciones administrativas

Cada `PATCH /api/admin/reservations/:id` registra una fila en `admin_audit_logs` con el admin que hizo el cambio (`admin_user_id`, `admin_email`), la accion (`update`, `status_change` o `cancel`), y el estado de la reserva antes y despues (`before_data`, `after_data`).

El registro es best-effort: `backend/lib/auditLog.js` atrapa cualquier error de insercion y solo lo deja en el log del servidor, sin afectar a la actualizacion de la reserva. Si `supabase-audit-log.sql` no se ha ejecutado todavia, la reserva se actualiza igual y solo falta la auditoria hasta que se ejecute el script.

Por ahora la auditoria cubre unicamente reservas (unica entidad con accion admin implementada). No incluye historiales clinicos, documentos ni reseñas.

`supabase-audit-log.sql` incluye grants explicitos (`select, insert` a `authenticated`) ademas de las politicas RLS: este proyecto no usa los privilegios por defecto del esquema `public`, asi que sin ese grant el INSERT falla con "permission denied for table admin_audit_logs" aunque la tabla y las politicas existan.

URLs habituales para desarrollo:

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/auth
http://127.0.0.1:3000/dashboard
http://127.0.0.1:3000/admin
```

Para conceder permisos de administracion a un usuario:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID';
```

## Reservas

El horario implementado es:

- Lunes a viernes: 10:30-13:30 y 17:00-20:00.
- Sabados: 11:00-13:30.
- Domingos: cerrado.
- Duracion general: 30 minutos.
- Cirugia: 60 minutos.
- Zona horaria operativa: `Europe/Madrid`.

El sistema bloquea dias pasados, horas pasadas del dia actual, huecos ocupados y solapamientos. La validacion se realiza tanto en frontend como en backend. El frontend utiliza la zona horaria `Europe/Madrid` para el bloqueo de horas pasadas, consistente con el servidor. El backend valida ademas que el telefono tenga al menos 6 caracteres.

## Rutas

```text
/                         Pagina publica
/servicios                 Ancla/ruta publica de servicios
/contacto                  Ancla/ruta publica de contacto
/auth                      Registro, login y recuperacion
/area-privada              Acceso al area privada
/dashboard                 Area privada del cliente
/dashboard/pets/:id        Ficha privada de mascota
/admin                     Panel de administracion
/terminos-legales          Terminos legales
/condiciones-uso           Condiciones de uso
/politica-privacidad       Politica de privacidad
/aviso-legal.html          Aviso legal
/privacidad.html           Privacidad
/cookies.html              Politica de cookies
/sitemap.html              Sitemap HTML
/sitemap.xml               Sitemap XML
/robots.txt                Robots
```

## API

```text
GET   /analytics.js
GET   /api/google-reviews
GET   /api/availability?month=YYYY-MM
GET   /api/supabase-config
POST  /api/reservations
PATCH /api/admin/reservations/:id
GET   /api/admin/clients?page=1&limit=20
GET   /api/admin/pets?page=1&limit=20[&client_id=UUID]
GET   /api/admin/reservations?page=1&limit=20
```

Los tres endpoints `/api/admin/*` de listado soportan paginacion server-side mediante `.range()` de Supabase. El limite maximo aceptado es 100 registros por pagina.

Las rutas `/api`, `/auth`, `/area-privada`, `/api/reservations`, `/api/admin` y `/api/supabase-config` tienen limitacion de peticiones mediante `express-rate-limit`, en dos niveles:

- `authLimiter` (mas estricto, `AUTH_RATE_LIMIT`, por defecto 10 peticiones/15 min): `/auth`, `/area-privada` y `/api/admin`, las rutas de acceso a login y de acciones administrativas autenticadas. En desarrollo local se recomienda `AUTH_RATE_LIMIT=100` (ya incluido en `.env.example`) para no bloquearte al probar el panel admin; en produccion manten `10`.
- `sensitiveLimiter` (`SENSITIVE_RATE_LIMIT`, por defecto 30 peticiones/15 min): `/api/reservations` y `/api/supabase-config`.

El login, registro y recuperacion de contraseña se realizan directamente desde el navegador contra la API de Supabase Auth (no pasan por el backend), por lo que `authLimiter` protege el acceso a las paginas y a la API admin, pero no sustituye la limitacion propia de Supabase Auth sobre esas llamadas.

## Estructura Del Proyecto

```text
vercel.json                     Configuracion de despliegue en Vercel
tailwind.config.js              Configuracion de Tailwind: tema, colores, fuentes y plugins
tsconfig.json                   Configuracion de TypeScript (noEmit, allowJs, strict)
DESIGN.md                       Tokens de diseño: paleta de color, tipografia y escalas
supabase-reservations.sql       Modelo SQL de reservas
supabase-client-area.sql        Modelo SQL de clientes, mascotas y documentos
supabase-audit-log.sql          Modelo SQL de auditoria de acciones administrativas (reservas)
reviews.local.json              Reseñas locales de fallback

types/
  api.d.ts                      Contratos de tipos de las respuestas de la API
  models.d.ts                   Tipos de los modelos de dominio (reserva, cliente, mascota...)

backend/
  server.js                     Punto de entrada: imports, middlewares globales y montaje de routers
  load-env.js                   Precarga dotenv antes de cualquier import (usado con --import)

  lib/
    utils.js                    Utilidades puras: validacion, escape, helpers de cadena
    supabase.js                 Clientes Supabase: supabase (anon) y supabaseAdmin (service role)
    availability.js             Logica pura de slots y disponibilidad (testeable sin efectos secundarios)
    googleCalendar.js           Integracion con Google Calendar (cuenta de servicio)
    resend.js                   Integracion con Resend para email de confirmacion
    reviews.js                  Google Places / reseñas locales con cache
    reservations.js             Acceso a datos y logica de negocio de reservas
    auditLog.js                 Registro best-effort de auditoria en admin_audit_logs

  middleware/
    rateLimiter.js               apiLimiter y sensitiveLimiter (express-rate-limit)

  routes/
    pages.js                    Rutas HTML publicas y privadas
    config.js                   /api/supabase-config y /analytics.js
    reviews.js                  /api/google-reviews
    reservations.js             /api/availability y /api/reservations
    admin.js                    /api/admin/* (PATCH, GET paginados)

frontend/
  code.html                     Pagina publica principal
  booking.js                    Calendario y formulario de reservas (frontend)
  reviews.js                    Carga y renderizado de reseñas (frontend)
  image-sources.js              Fuentes y recursos visuales de la web
  i18n.js                       Textos y traducciones de interfaz
  auth.html / auth.js           Registro, login y recuperacion de contraseña
  dashboard.html / dashboard.js Area privada del cliente
  pet-detail.html / pet-detail.js Ficha privada de mascota
  admin.html / admin.js         Panel de administracion (orquesta los modulos de modules/admin)
  client-area.css               Estilos del area privada y administracion
  supabase-client.js             Cliente publico de Supabase (frontend)

  modules/
    admin/
      state.js                  Estado compartido y referencias al DOM del panel admin
      utils.js                  Helpers de fecha/semana para el calendario admin
      clients.js                 Carga y render paginado de clientes
      pets.js                    Formulario y render de mascotas
      records.js                 Formulario y render de historiales clinicos
      documents.js                Subida y render de documentos privados
      reservations.js             Calendario semanal y render de reservas
    shared/
      api.js                     Cliente centralizado de llamadas a la API (fetch)
      auth.js                    Helpers de sesion/roles con Supabase Auth
      storage.js                 Helpers de subida a Supabase Storage
      utils.js                   Utilidades compartidas de frontend

  src/
    input.css                    Directivas de Tailwind (@tailwind base/components/utilities)

  public/
    tailwind.css                 CSS compilado por Tailwind (generado con npm run build:css)

tests/
  availability.test.js          Tests unitarios de logica de disponibilidad (Vitest)
  reservations.test.js          Tests unitarios de validacion de reservas y comportamiento de email (Vitest)
```

## Despliegue En Vercel

El repositorio incluye `vercel.json` y esta preparado para desplegar `server.js` como funcion Node.

Configuracion recomendada:

```text
Framework Preset: Other
Build Command: npm run build:css
Output Directory: vacio
Install Command: npm install
```

El build command compila Tailwind a `public/tailwind.css` antes de que Vercel empaquete la funcion. En produccion, Vercel inyecta las variables de entorno directamente en `process.env`, por lo que dotenv no se necesita.

Variables minimas recomendadas para produccion con Supabase:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=public_anon_key
SUPABASE_SERVICE_ROLE_KEY=server_only_secret
GOOGLE_ENABLE_LIVE_REVIEWS=false
REVIEWS_CACHE_TTL_SECONDS=21600
GOOGLE_DAILY_REQUEST_LIMIT=25
API_RATE_LIMIT=300
SENSITIVE_RATE_LIMIT=30
```

Las variables deben configurarse en:

```text
Vercel > Project Settings > Environment Variables
```

## Seguridad

- No subir `.env`, claves privadas ni credenciales reales al repositorio.
- Mantener `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en servidor.
- Activar y revisar RLS antes de usar datos reales.
- Mantener los buckets `pet-images` y `pet-documents` como privados.
- Validar operaciones sensibles desde backend y desde politicas de base de datos.
- Servir paginas privadas con `Cache-Control: no-store`.
- Limitar peticiones a APIs publicas y rutas sensibles.
- Revisar capturas, datos de prueba y documentos antes de publicar el repositorio.
- No publicar `reservations.json`, `.google-usage.json`, claves de Google, claves de Resend ni service role keys.

## Licencia

Copyright (c) 2025 Clinica Veterinaria Vetusta.

Todos los derechos reservados. Este proyecto y su codigo fuente han sido desarrollados para Clinica Veterinaria Vetusta. Queda prohibida la reproduccion, distribucion, modificacion o reutilizacion total o parcial del codigo, diseño, textos, imagenes o cualquier otro recurso del proyecto sin autorizacion previa por escrito.

## Puntos Pendientes / Mejoras Recomendadas

### Prioridad alta

- **Configurar Google Calendar real de la clinica**
  - Definir `GOOGLE_CALENDAR_ID`, `GOOGLE_CLIENT_EMAIL` y `GOOGLE_PRIVATE_KEY`.
  - Compartir el calendario de la clinica con la cuenta de servicio de Google.
  - Las reservas funcionan aunque Calendar no este configurado, pero apareceran como no sincronizadas o con error de sincronizacion.

- **Mejorar el estado de sincronizacion con Google Calendar**
  - Diferenciar entre "Google Calendar no configurado" y un error real de sincronizacion.
  - Evitar mensajes confusos en desarrollo/local.

- **Añadir edicion completa de reservas desde el panel admin**
  - Permitir cambiar fecha/hora, notas, estado y profesional asignado si aplica.
  - Actualmente el panel permite cancelar reservas, pero no una edicion visual completa.

- **Añadir tests de integracion para rutas criticas**
  - Cubrir rutas de admin/reservas, auditoria, Resend y Google Calendar.
  - Usar mocks para no llamar a servicios externos reales.

### Prioridad media

- **Completar instrumentacion GA4 de eventos importantes**
  - Reserva creada.
  - Clic en telefono.
  - Envio de formulario.
  - Login admin.
  - Descarga de documentos, si aplica.

- **Añadir seguimiento con Google Search Console**
  - Revisar rendimiento SEO local.
  - Detectar busquedas, paginas con impresiones y posibles problemas de indexacion.

- **Ampliar gestion de citas**
  - Reprogramacion por parte del cliente mediante enlace seguro.
  - Cancelacion por parte del cliente mediante enlace seguro.
  - Reglas de disponibilidad por servicio.
  - Profesionales asignados.

- **Añadir busqueda y filtros en el panel admin**
  - Buscar por cliente, telefono, mascota, fecha o estado.
  - Util cuando haya muchas reservas/clientes.

- **Ampliar auditoria administrativa**
  - La auditoria de cambios de reserva ya existe.
  - Pendiente ampliarla a historiales clinicos, documentos y otros cambios sensibles.

### Prioridad baja / futuro

- **Añadir paginas individuales para servicios clave**
  - Vacunacion, cirugia, urgencias, medicina preventiva o peluqueria.
  - Util para SEO local si se van a trabajar contenidos especificos.

- **Implementar recordatorios automaticos**
  - Vacunas, revisiones y tratamientos preventivos.
  - Preferiblemente mediante email o WhatsApp Business.

- **Mostrar reseñas de Google en tiempo real**
  - Usar Google Places API (Place Details) con cache para no consultar en cada visita.
  - Para una sola ubicacion el coste es $0 (free tier de 10.000 peticiones/mes).
  - Requiere configurar Google Cloud y registrar tarjeta.

- **Incorporar despliegues por entorno, logs centralizados y alertas**
  - Separar desarrollo/staging/produccion.
  - Revisar errores de produccion de forma mas comoda.

- **Explorar pagos o depositos online**
  - Solo si la clinica quiere cobrar reservas, señales o servicios concretos.
