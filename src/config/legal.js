const TERMS_NOTICE_VERSION = process.env.TERMS_NOTICE_VERSION || 'draft-2026-10-04';
const PRIVACY_NOTICE_VERSION = process.env.PRIVACY_NOTICE_VERSION || 'draft-2026-10-04';

const hasLaunchLegalDetails = () => {
  const providerName = process.env.SERVICE_PROVIDER_NAME?.trim();
  const providerAddress = process.env.SERVICE_PROVIDER_ADDRESS?.trim();
  const privacyEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim();
  const supportEmail = process.env.SUPPORT_EMAIL?.trim();
  return process.env.LEGAL_NOTICES_APPROVED === 'true'
    && TERMS_NOTICE_VERSION.startsWith('draft') === false
    && PRIVACY_NOTICE_VERSION.startsWith('draft') === false
    && Boolean(providerName && providerAddress && privacyEmail && supportEmail);
};

module.exports = { TERMS_NOTICE_VERSION, PRIVACY_NOTICE_VERSION, hasLaunchLegalDetails };
