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
SECURITY INVOKER
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