CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_text text NOT NULL,
  customer_id text,
  source text NOT NULL DEFAULT 'Manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  product_version text,
  sentiment text NOT NULL DEFAULT 'neutral',
  sentiment_score real NOT NULL DEFAULT 0,
  topics text[] NOT NULL DEFAULT '{}',
  severity text NOT NULL DEFAULT 'low',
  ai_insight text,
  is_recurring boolean NOT NULL DEFAULT false,
  embedding vector(1536)
);

GRANT SELECT, INSERT, UPDATE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.feedback TO anon;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback readable by everyone" ON public.feedback FOR SELECT USING (true);
CREATE POLICY "feedback insertable by everyone" ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "feedback updatable by everyone" ON public.feedback FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.product_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  release_date timestamptz NOT NULL DEFAULT now(),
  description text
);

GRANT SELECT ON public.product_releases TO anon, authenticated;
GRANT ALL ON public.product_releases TO service_role;
ALTER TABLE public.product_releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "releases readable by everyone" ON public.product_releases FOR SELECT USING (true);

CREATE TABLE public.feedback_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  related_feedback_id uuid NOT NULL REFERENCES public.feedback(id) ON DELETE CASCADE,
  similarity_score real NOT NULL,
  relationship_type text NOT NULL DEFAULT 'related_issue',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, related_feedback_id)
);

CREATE INDEX feedback_relationships_feedback_id_idx ON public.feedback_relationships(feedback_id);
GRANT SELECT, INSERT ON public.feedback_relationships TO anon, authenticated;
GRANT ALL ON public.feedback_relationships TO service_role;
ALTER TABLE public.feedback_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relationships readable by everyone" ON public.feedback_relationships FOR SELECT USING (true);
CREATE POLICY "relationships insertable by everyone" ON public.feedback_relationships FOR INSERT WITH CHECK (true);

CREATE INDEX feedback_embedding_idx ON public.feedback USING hnsw (embedding vector_cosine_ops);
CREATE INDEX feedback_created_at_idx ON public.feedback(created_at DESC);

CREATE OR REPLACE FUNCTION public.match_feedback(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  exclude_id uuid DEFAULT NULL,
  min_similarity real DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  feedback_text text,
  customer_id text,
  source text,
  created_at timestamptz,
  product_version text,
  sentiment text,
  sentiment_score real,
  topics text[],
  severity text,
  similarity real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.feedback_text, f.customer_id, f.source, f.created_at, f.product_version,
         f.sentiment, f.sentiment_score, f.topics, f.severity,
         (1 - (f.embedding <=> query_embedding))::real AS similarity
  FROM public.feedback f
  WHERE f.embedding IS NOT NULL
    AND (exclude_id IS NULL OR f.id <> exclude_id)
    AND (1 - (f.embedding <=> query_embedding)) >= min_similarity
  ORDER BY f.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_feedback(vector, int, uuid, real) TO anon, authenticated, service_role;

INSERT INTO public.product_releases (version, release_date, description) VALUES
  ('v2.4', now() - interval '95 days', 'Beta release: new dashboard shell and routing layer.'),
  ('v2.5', now() - interval '70 days', 'Performance pass on dashboard rendering and search indexing.'),
  ('v2.6', now() - interval '52 days', 'Auth refresh, onboarding redesign.'),
  ('v2.7', now() - interval '33 days', 'Reporting digest, bulk actions.'),
  ('v2.8', now() - interval '14 days', 'New analytics engine and navigation prefetching.');

INSERT INTO public.feedback (feedback_text, customer_id, source, created_at, product_version, sentiment, sentiment_score, topics, severity) VALUES
  ('The dashboard takes too long to load and navigating between pages feels very slow.', 'acme-labs', 'Beta Testing', now() - interval '92 days', 'v2.4', 'negative', -0.72, ARRAY['Navigation','Performance']::text[], 'high'),
  ('Dashboard navigation is painfully slow, especially the first load of the day.', 'northwind', 'Beta Testing', now() - interval '89 days', 'v2.4', 'negative', -0.68, ARRAY['Navigation','Performance']::text[], 'high'),
  ('Switching tabs in the dashboard spins for ages before anything renders.', 'globex', 'Intercom', now() - interval '85 days', 'v2.4', 'negative', -0.65, ARRAY['Performance','UI']::text[], 'medium'),
  ('Login occasionally fails with an invalid session error after SSO redirect.', 'initech', 'Jira', now() - interval '80 days', 'v2.4', 'negative', -0.6, ARRAY['Authentication','Bugs']::text[], 'high'),
  ('Payment page rejected my card three times, then charged me twice.', 'umbrella', 'Support Tickets', now() - interval '76 days', 'v2.4', 'negative', -0.85, ARRAY['Payments','Bugs']::text[], 'critical'),
  ('Search returns nothing for exact product names. Feels broken.', 'hooli', 'Discord', now() - interval '72 days', 'v2.5', 'negative', -0.55, ARRAY['Search','Bugs']::text[], 'medium'),
  ('The performance fix in 2.5 helped, pages open noticeably faster now.', 'acme-labs', 'Intercom', now() - interval '68 days', 'v2.5', 'positive', 0.62, ARRAY['Performance','Navigation']::text[], 'low'),
  ('Dark mode would be amazing for the reports view.', 'stark-industries', 'Discord', now() - interval '64 days', 'v2.5', 'neutral', 0.1, ARRAY['Feature Requests','UI']::text[], 'low'),
  ('Notifications arrive in batches hours late, sometimes duplicated.', 'globex', 'Support Tickets', now() - interval '61 days', 'v2.5', 'negative', -0.5, ARRAY['Notifications','Bugs']::text[], 'medium'),
  ('Export to CSV truncates rows past 10k silently.', 'initech', 'Jira', now() - interval '58 days', 'v2.5', 'negative', -0.58, ARRAY['Bugs']::text[], 'high'),
  ('Navigation feels smooth since the last update, thank you.', 'wayne-enterprises', 'Intercom', now() - interval '54 days', 'v2.5', 'positive', 0.7, ARRAY['Navigation','Performance']::text[], 'low'),
  ('Onboarding step three is confusing; I wasn''t sure whether to skip it.', 'northwind', 'Beta Testing', now() - interval '50 days', 'v2.6', 'neutral', -0.15, ARRAY['UI','Feature Requests']::text[], 'medium'),
  ('Two-factor codes are rejected the first time almost every login.', 'hooli', 'Discord', now() - interval '47 days', 'v2.6', 'negative', -0.66, ARRAY['Authentication','Bugs']::text[], 'high'),
  ('Refund took eleven days and nobody could tell me the status.', 'umbrella', 'Support Tickets', now() - interval '44 days', 'v2.6', 'negative', -0.74, ARRAY['Payments']::text[], 'high'),
  ('Dashboard is quick again. Whatever you changed, keep it.', 'acme-labs', 'Intercom', now() - interval '41 days', 'v2.6', 'positive', 0.68, ARRAY['Performance']::text[], 'low'),
  ('Filters reset whenever I navigate back from a detail page.', 'stark-industries', 'Jira', now() - interval '38 days', 'v2.6', 'negative', -0.45, ARRAY['Navigation','UI']::text[], 'medium'),
  ('Search ranking is better but synonyms still miss.', 'globex', 'Discord', now() - interval '35 days', 'v2.6', 'neutral', 0.05, ARRAY['Search']::text[], 'low'),
  ('App logged me out mid-session three times today.', 'initech', 'Support Tickets', now() - interval '31 days', 'v2.7', 'negative', -0.7, ARRAY['Authentication','Bugs']::text[], 'high'),
  ('Love the new weekly digest email, saved me an hour.', 'wayne-enterprises', 'Intercom', now() - interval '28 days', 'v2.7', 'positive', 0.8, ARRAY['Notifications','Feature Requests']::text[], 'low'),
  ('Charts render twice on load which makes the page flicker.', 'northwind', 'Beta Testing', now() - interval '25 days', 'v2.7', 'negative', -0.4, ARRAY['UI','Performance']::text[], 'medium'),
  ('Bulk actions silently fail for more than 200 selected rows.', 'hooli', 'Jira', now() - interval '22 days', 'v2.7', 'negative', -0.62, ARRAY['Bugs']::text[], 'high'),
  ('Could we get keyboard shortcuts for switching workspaces?', 'acme-labs', 'Discord', now() - interval '19 days', 'v2.7', 'neutral', 0.2, ARRAY['Feature Requests','Navigation']::text[], 'low'),
  ('Checkout timed out on mobile and my cart was emptied.', 'umbrella', 'Support Tickets', now() - interval '15 days', 'v2.8', 'negative', -0.8, ARRAY['Payments','Performance']::text[], 'critical'),
  ('Pages have started lagging again after the newest update.', 'globex', 'Intercom', now() - interval '12 days', 'v2.8', 'negative', -0.6, ARRAY['Performance','Navigation']::text[], 'high'),
  ('Moving between dashboard sections is taking several seconds once more.', 'initech', 'Jira', now() - interval '9 days', 'v2.8', 'negative', -0.7, ARRAY['Navigation','Performance']::text[], 'high'),
  ('Search is finally fast, big improvement.', 'stark-industries', 'Discord', now() - interval '6 days', 'v2.8', 'positive', 0.66, ARRAY['Search','Performance']::text[], 'low'),
  ('Notification settings don''t persist after I save them.', 'wayne-enterprises', 'Support Tickets', now() - interval '4 days', 'v2.8', 'negative', -0.52, ARRAY['Notifications','Bugs']::text[], 'medium'),
  ('Navigation between dashboard pages is sluggish again since 2.8.', 'northwind', 'Intercom', now() - interval '2 days', 'v2.8', 'negative', -0.68, ARRAY['Navigation','Performance']::text[], 'high');