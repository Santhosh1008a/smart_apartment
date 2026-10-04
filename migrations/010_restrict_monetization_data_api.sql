-- Monetization access is served by the authenticated super-admin API. Keep the
-- tables unavailable to browser roles, including GraphQL/Data API discovery.
-- RLS and its super-admin policy remain enabled as defense in depth if grants
-- are intentionally added to authenticated clients in a future integration.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'subscription_plans', 'community_subscriptions', 'platform_payment_transactions',
    'subscription_events', 'platform_usage_events'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', table_name);
  END LOOP;
END $$;
