const logger = require('./logger');

/**
 * Sends an email notification.
 * @param {string} to - Recipient email.
 * @param {string} subject - Email subject.
 * @param {string} body - Email html/text body.
 */
exports.sendEmail = async (to, subject, body) => {
  // TODO: Integrate actual SMTP like SendGrid / AWS SES / Nodemailer here
  logger.info(`[EMAIL SENT] To: ${to} | Subject: ${subject}`);
  // logger.debug(`Email Body: ${body}`);
  return true;
};

/**
 * Sends an SMS notification.
 * @param {string} to - Recipient phone number.
 * @param {string} message - SMS text content.
 */
exports.sendSMS = async (to, message) => {
  // TODO: Integrate Twilio / Nexmo / MSG91 here
  logger.info(`[SMS SENT] To: ${to} | Message: ${message}`);
  return true;
};
