const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const parsedUrl = new URL(supabaseUrl);
if (parsedUrl.protocol !== 'https:') {
  throw new Error('SUPABASE_URL must be an https:// URL.');
}

const supabaseFetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (err) {
    logger.error('Supabase network fetch failed', {
      host: parsedUrl.host,
      message: err.message,
      cause: err.cause?.message,
      code: err.cause?.code,
    });
    throw err;
  }
};

logger.info('Supabase service client initialized', {
  urlConfigured: Boolean(supabaseUrl),
  serviceRoleConfigured: Boolean(supabaseKey),
  host: parsedUrl.host,
  keyType: supabaseKey.startsWith('sb_secret_') ? 'secret' : 'jwt',
});

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: supabaseFetch,
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

module.exports = supabase;
