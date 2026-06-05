import {
  cleanEnvValue,
  escapeHtmlText,
  formatReservationServiceForCalendar,
} from "./utils.js";

const resendApiKey = cleanEnvValue(process.env.RESEND_API_KEY);
const reservationFromEmail = cleanEnvValue(
  process.env.RESERVATION_FROM_EMAIL
    || "Clínica Veterinaria Vetusta <reservas@clinicavetusta.com>",
);
const clinicPhone = cleanEnvValue(process.env.CLINIC_PHONE || "985 20 65 58");

export async function sendReservationEmailIfRequested(reservation, emailCopy) {
  if (!emailCopy) {
    return { requested: false, sent: false, pending: false };
  }

  if (!reservation.email) {
    return {
      requested: true,
      sent: false,
      pending: true,
      message:
        "Reserva creada. No se ha enviado la copia por email porque no se indicó una dirección de email.",
    };
  }

  if (!resendApiKey) {
    return {
      requested: true,
      sent: false,
      pending: true,
      message:
        "Reserva creada. No se ha enviado la copia por email porque falta configurar RESEND_API_KEY en el backend.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: reservationFromEmail,
        to: reservation.email,
        subject: `Reserva registrada ${reservation.code} - Clínica Veterinaria Vetusta`,
        text: reservationEmailText(reservation),
        html: reservationEmailHtml(reservation),
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload?.message
          || `El proveedor de email respondió con ${response.status}.`,
      );
    }

    return { requested: true, sent: true, pending: false };
  } catch (error) {
    console.error("Reservation email error:", error);
    return {
      requested: true,
      sent: false,
      pending: true,
      message:
        "Reserva creada. No se ha podido enviar la copia por email. Revisa RESEND_API_KEY, RESERVATION_FROM_EMAIL y el dominio verificado en Resend.",
    };
  }
}

function reservationEmailText(reservation) {
  return [
    `Hola ${reservation.nombre},`,
    "",
    "Tu solicitud de cita se ha recibido correctamente en Clínica Veterinaria Vetusta.",
    `Código de reserva: ${reservation.code}`,
    `Fecha y hora: ${formatReservationDateTime(reservation.datetime)}`,
    `Mascota: ${formatPetType(reservation.mascota)}`,
    `Servicio: ${formatReservationServiceForCalendar(reservation.servicio)}`,
    reservation.notes ? `Motivo de la visita: ${reservation.notes}` : null,
    `Teléfono de la clínica: ${clinicPhone}`,
    "",
    "Te contactaremos si necesitamos ajustar algún detalle.",
  ]
    .filter(Boolean)
    .join("\n");
}

function reservationEmailHtml(reservation) {
  return `
    <div style="font-family:Arial,sans-serif;color:#1b1c1c;line-height:1.5">
      <h1 style="color:#1b4332">Clínica Veterinaria Vetusta</h1>
      <p>Hola ${escapeHtmlText(reservation.nombre)}, tu solicitud de cita se ha recibido correctamente.</p>
      <p><strong>Código de reserva:</strong> ${escapeHtmlText(reservation.code)}</p>
      <p><strong>Fecha y hora:</strong> ${escapeHtmlText(formatReservationDateTime(reservation.datetime))}</p>
      <p><strong>Mascota:</strong> ${escapeHtmlText(formatPetType(reservation.mascota))}</p>
      <p><strong>Servicio:</strong> ${escapeHtmlText(formatReservationServiceForCalendar(reservation.servicio))}</p>
      ${reservation.notes ? `<p><strong>Motivo de la visita:</strong> ${escapeHtmlText(reservation.notes)}</p>` : ""}
      <p><strong>Teléfono de la clínica:</strong> ${escapeHtmlText(clinicPhone)}</p>
      <p>Te contactaremos si necesitamos ajustar algún detalle.</p>
    </div>
  `;
}

function formatReservationDateTime(datetime) {
  if (!datetime) {
    return "Sin fecha";
  }

  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  return `${dateLabel} a las ${time}`;
}

function formatPetType(value) {
  const labels = { perro: "Perro", gato: "Gato", otro: "Otro" };
  return labels[value] || value || "Sin indicar";
}
