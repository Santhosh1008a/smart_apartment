// All API tests mock data access. These placeholders let the Supabase client
// initialize without using any real project credentials or making network calls.
process.env.SUPABASE_URL ||= 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-only-service-key';
process.env.JWT_ACCESS_SECRET ||= 'test-only-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret-not-for-production';
