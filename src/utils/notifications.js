/**
 * Sends an email notification.
 * @param {string} to - Recipient email.
 * @param {string} subject - Email subject.
 * @param {string} body - Email html/text body.
 */
exports.sendEmail = async (to, subject, body) => {
  // Do not report delivery until an email provider is configured.
  return false;
};

/**
 * Sends an SMS notification.
 * @param {string} to - Recipient phone number.
 * @param {string} message - SMS text content.
 */
exports.sendSMS = async (to, message) => {
  // Do not report delivery until an SMS provider is configured.
  return false;
};
