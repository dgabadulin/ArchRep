'use strict';

const nodemailer = require('nodemailer');

function envTrim(name) {
  const v = process.env[name];
  if (v == null) return '';
  return String(v).trim();
}

function parseBoolEnv(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function getSmtpConfig() {
  const host = envTrim('SMTP_HOST');
  const from = envTrim('MAIL_FROM');
  const portRaw = envTrim('SMTP_PORT');
  const port = portRaw ? Number(portRaw) : 587;
  const secure = parseBoolEnv(process.env.SMTP_SECURE, port === 465);
  const user = envTrim('SMTP_USER');
  const pass = envTrim('SMTP_PASS');
  return { host, from, port, secure, user, pass };
}

function assertSmtpConfigured() {
  const cfg = getSmtpConfig();
  if (!cfg.host) {
    const err = new Error('Не задан SMTP_HOST в env');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  if (!cfg.from) {
    const err = new Error('Не задан MAIL_FROM в env');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  return cfg;
}

let transporter = null;

function getTransporter() {
  const cfg = assertSmtpConfigured();
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
  }
  return transporter;
}

/**
 * @param {{ to: string|string[], subject: string, text?: string, html?: string }} opts
 */
async function sendEmail(opts) {
  const cfg = assertSmtpConfigured();
  const to = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;
  if (!to) {
    const err = new Error('Пустой список получателей');
    err.code = 'NO_RECIPIENTS';
    throw err;
  }
  const transport = getTransporter();
  const info = await transport.sendMail({
    from: cfg.from,
    to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return { messageId: info.messageId, accepted: info.accepted || [] };
}

module.exports = {
  getSmtpConfig,
  assertSmtpConfigured,
  sendEmail,
};
