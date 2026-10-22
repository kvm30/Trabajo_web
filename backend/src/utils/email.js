const nodemailer = require('nodemailer');

async function sendPasswordResetEmail(email, resetUrl) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new Error('Configura SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD y SMTP_FROM para enviar correos');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Recuperación de contraseña',
    text: `Recibimos una solicitud para cambiar la contraseña de tu cuenta. Abre este enlace antes de una hora: ${resetUrl}\n\nSi no solicitaste este cambio, ignora este correo.`,
  });
}

module.exports = { sendPasswordResetEmail };
