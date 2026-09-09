const nodemailer = require('nodemailer');

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildEmailMessage(notification) {
  const payload = notification.payload || {};
  const students = Array.isArray(payload.students) ? payload.students : [];
  const routeLabel = payload.routeNo ? `Bus ${payload.routeNo}` : 'College bus';
  const predictedEta = payload.predictedEta ? new Date(payload.predictedEta) : null;
  const etaLabel = predictedEta && !Number.isNaN(predictedEta.getTime())
    ? predictedEta.toLocaleString('en-IN', {
        timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'currently unavailable';
  const classLabel = [payload.department, payload.year, payload.section].filter(Boolean).join(' / ');
  const studentLines = students.length
    ? students.map((student) => `- ${student.name} (${student.rollNo})`).join('\n')
    : '- No assigned students were present in the alert snapshot.';
  const studentItems = students.length
    ? students
        .map((student) => `<li>${escapeHtml(student.name)} (${escapeHtml(student.rollNo)})</li>`)
        .join('')
    : '<li>No assigned students were present in the alert snapshot.</li>';

  return {
    subject: `${routeLabel} is expected to reach college late`,
    text: [
      `Hello ${payload.advisorName || 'Advisor'},`,
      '',
      `${routeLabel} is currently predicted to reach college at ${etaLabel}.`,
      classLabel ? `Class group: ${classLabel}` : null,
      '',
      'Students assigned to this bus and class group:',
      studentLines,
      '',
      'This is a transport-delay notice, not a bus-attendance record. Please verify attendance in class.',
    ].filter((line) => line !== null).join('\n'),
    html: [
      `<p>Hello ${escapeHtml(payload.advisorName || 'Advisor')},</p>`,
      `<p><strong>${escapeHtml(routeLabel)}</strong> is currently predicted to reach college at <strong>${escapeHtml(etaLabel)}</strong>.</p>`,
      classLabel ? `<p>Class group: ${escapeHtml(classLabel)}</p>` : '',
      '<p>Students assigned to this bus and class group:</p>',
      `<ul>${studentItems}</ul>`,
      '<p><strong>This is a transport-delay notice, not a bus-attendance record.</strong> Please verify attendance in class.</p>',
    ].join(''),
  };
}

function requiredSmtpConfig(env) {
  const config = {
    host: env.SMTP_HOST?.trim(),
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE || '').toLowerCase() === 'true',
    user: env.SMTP_USER?.trim(),
    password: env.SMTP_PASSWORD,
    from: env.SMTP_FROM?.trim(),
  };
  if (!config.host || !config.from || !Number.isInteger(config.port) || config.port <= 0) {
    throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM are required for the SMTP notification provider');
  }
  if ((config.user && !config.password) || (!config.user && config.password)) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must either both be set or both be empty');
  }
  return config;
}

function createSmtpProvider(env = process.env) {
  const config = requiredSmtpConfig(env);
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(config.user ? { auth: { user: config.user, pass: config.password } } : {}),
  });
  const messageDomain = (config.from.match(/@([^>\s]+)>?$/)?.[1] || 'college-bus.local').replace(/[^a-z0-9.-]/gi, '');

  return {
    name: 'smtp',
    async sendEmail(notification) {
      const message = buildEmailMessage(notification);
      const result = await transporter.sendMail({
        from: config.from,
        to: notification.recipient,
        ...message,
        messageId: `<${notification.idempotencyKey}@${messageDomain}>`,
        headers: { 'X-College-Bus-Notification-ID': notification.idempotencyKey },
      });
      return { messageId: result.messageId || null };
    },
  };
}

function createConsoleProvider(logger = console) {
  return {
    name: 'console',
    async sendEmail(notification) {
      logger.info(`[notification:console] simulated outbox=${notification.id} key=${notification.idempotencyKey}`);
      return { messageId: `console:${notification.idempotencyKey}` };
    },
  };
}

function createNotificationProvider(env = process.env, logger = console) {
  const name = String(env.NOTIFICATION_PROVIDER || 'disabled').trim().toLowerCase();
  if (name === 'smtp') return createSmtpProvider(env);
  if (name === 'console') return createConsoleProvider(logger);
  if (name === 'disabled') return null;
  throw new Error(`Unsupported NOTIFICATION_PROVIDER: ${name}`);
}

module.exports = {
  buildEmailMessage,
  createConsoleProvider,
  createNotificationProvider,
  createSmtpProvider,
  escapeHtml,
  requiredSmtpConfig,
};
