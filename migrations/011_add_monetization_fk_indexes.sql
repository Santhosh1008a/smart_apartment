-- Cover foreign keys used for subscription audit lookups and nullable creator references.
CREATE INDEX IF NOT EXISTS subscription_plans_created_by_idx
  ON subscription_plans (created_by);
CREATE INDEX IF NOT EXISTS community_subscriptions_created_by_idx
  ON community_subscriptions (created_by);
CREATE INDEX IF NOT EXISTS subscription_events_subscription_date_idx
  ON subscription_events (subscription_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS subscription_events_from_plan_idx
  ON subscription_events (from_plan_id);
CREATE INDEX IF NOT EXISTS subscription_events_to_plan_idx
  ON subscription_events (to_plan_id);
CREATE INDEX IF NOT EXISTS subscription_events_actor_idx
  ON subscription_events (actor_user_id);
