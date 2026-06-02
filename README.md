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

## Stack Tecnico

- Node.js 18+
- Express 4
- Supabase JS 2
- Supabase Auth, Postgres, RLS y Storage
- Express Rate Limit
- Dotenv
- HTML, CSS y JavaScript vanilla
- Tailwind CDN en la interfaz publica
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
npm run dev   Ejecuta server.js con recarga mediante node --watch
npm start     Ejecuta server.js
```

## Variables De Entorno

El proyecto funciona por capas. Para desarrollo basico se puede trabajar con reseñas locales y reservas en archivo temporal/local. Para produccion se recomienda configurar Supabase y las integraciones necesarias.

### Base

```env
PORT=3000
CLINIC_PHONE="YOUR_PHONE"
API_RATE_LIMIT=300
SENSITIVE_RATE_LIMIT=30
```

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

El repositorio incluye dos scripts SQL principales:

- `supabase-reservations.sql`: tabla de reservas, indices, estados, funciones de disponibilidad y vinculacion con perfiles.
- `supabase-client-area.sql`: perfiles, mascotas, historiales, documentos, logs de subida, buckets privados y politicas RLS.

Pasos recomendados:

1. Crear un proyecto en Supabase.
2. Abrir SQL Editor.
3. Ejecutar `supabase-reservations.sql`.
4. Ejecutar `supabase-client-area.sql`.
5. Revisar las politicas RLS y buckets `pet-images` y `pet-documents`.
6. Configurar las URLs de autenticacion permitidas.

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

El sistema bloquea dias pasados, horas pasadas del dia actual, huecos ocupados y solapamientos. La validacion se realiza tanto en frontend como en backend.

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
```

Las rutas `/api`, `/auth`, `/area-privada`, `/api/reservations`, `/api/admin` y `/api/supabase-config` tienen limitacion de peticiones mediante `express-rate-limit`.

## Estructura Del Proyecto

```text
server.js                       Backend Express, APIs, rutas y validaciones
code.html                       Pagina publica principal
booking.js                      Calendario y formulario de reservas
reviews.js                      Carga y renderizado de reseñas
image-sources.js                Fuentes y recursos visuales de la web
i18n.js                         Textos y traducciones de interfaz
auth.html / auth.js             Registro, login y recuperacion de contraseña
dashboard.html / dashboard.js   Area privada del cliente
pet-detail.html / pet-detail.js Ficha privada de mascota
admin.html / admin.js           Panel de administracion
client-area.css                 Estilos del area privada y administracion
supabase-client.js              Cliente publico de Supabase
supabase-reservations.sql       Modelo SQL de reservas
supabase-client-area.sql        Modelo SQL de clientes, mascotas y documentos
reviews.local.json              Reseñas locales de fallback
DESIGN.md                       Guia visual y criterios de diseño
vercel.json                     Configuracion de despliegue en Vercel
```

## Despliegue En Vercel

El repositorio incluye `vercel.json` y esta preparado para desplegar `server.js` como funcion Node.

Configuracion recomendada:

```text
Framework Preset: Other
Build Command: vacio
Output Directory: vacio
Install Command: npm install
```

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

## Posibles Mejoras Futuras

- Incorporar una suite de tests automatizados para validacion de reservas, permisos de administracion y flujos de autenticacion.
- Completar la instrumentacion de GA4 con eventos de reservas, llamadas, formularios, login y descargas de documentos.
- Añadir seguimiento con Google Search Console y revision periodica de rendimiento SEO local.
- Ampliar la gestion de citas con reprogramacion, cancelaciones iniciadas por cliente, profesionales asignados y reglas de disponibilidad por servicio.
- Crear un panel editorial para modificar textos, servicios, equipo, imagenes y preguntas frecuentes sin tocar codigo.
- Añadir paginas individuales para servicios clave como vacunacion, cirugia, urgencias, medicina preventiva o peluqueria.
- Implementar recordatorios automaticos de vacunas, revisiones y tratamientos preventivos mediante email o WhatsApp Business.
- Integrar una pasarela de pagos o deposito para determinados tipos de reserva.
- Mejorar el panel de administracion con busqueda avanzada, filtros, exportaciones y metricas operativas.
- Añadir auditoria de acciones administrativas sobre historiales, documentos y cambios de reserva.
- Optimizar Core Web Vitals con estrategia avanzada de imagenes, fuentes, carga diferida y reduccion de scripts externos.
- Incorporar despliegues por entorno, revision de logs centralizada y alertas de errores.
- Explorar integracion con CRM o herramientas de email marketing para comunicaciones segmentadas.
