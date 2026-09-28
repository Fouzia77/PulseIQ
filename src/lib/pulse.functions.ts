import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  analyzeText,
  embedTexts,
  generateInsight,
  serverSupabase,
} from "./pulse.server";
import type { AnalysisResult, FeedbackRow, SimilarFeedback } from "./pulse-types";

const RECURRING_THRESHOLD = 0.72;

const submitSchema = z.object({
  text: z.string().min(5).max(2000),
  source: z.string().min(1).max(60),
  productVersion: z.string().max(30).optional(),
  customerId: z.string().max(60).optional(),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }): Promise<AnalysisResult> => {
    const supabase = serverSupabase();

    // 1. AI analysis + 2. embedding of the cleaned text
    const cleaned = data.text.trim().replace(/\s+/g, " ");
    const [analysis, [embedding]] = await Promise.all([
      analyzeText(cleaned),
      embedTexts([cleaned]),
    ]);

    // 3. semantic search across historical feedback
    const { data: matches, error: matchError } = await supabase.rpc("match_feedback", {
      query_embedding: embedding as unknown as string,
      match_count: 5,
      exclude_id: null,
      min_similarity: 0.45,
    });
    if (matchError) throw new Error(matchError.message);
    const related = (matches ?? []) as SimilarFeedback[];

    const isRecurring = related.some((r) => r.similarity >= RECURRING_THRESHOLD);

    // 4. product release context
    const { data: releases } = await supabase
      .from("product_releases")
      .select("version, release_date, description")
      .order("release_date", { ascending: false });

    // 5. AI insight over the retrieved memory
    const insight = await generateInsight({
      text: cleaned,
      analysis,
      related: related.map((r) => ({
        text: r.feedback_text,
        date: r.created_at,
        source: r.source,
        similarity: Number(r.similarity.toFixed(2)),
        sentiment: r.sentiment,
      })),
      releases: releases ?? [],
      isRecurring,
    });

    // 6. persist
    const { data: inserted, error } = await supabase
      .from("feedback")
      .insert({
        feedback_text: cleaned,
        customer_id: data.customerId || null,
        source: data.source,
        product_version: data.productVersion || null,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        topics: analysis.topics,
        severity: analysis.severity,
        ai_insight: insight,
        is_recurring: isRecurring,
        embedding: embedding as unknown as string,
      })
      .select(
        "id, feedback_text, customer_id, source, created_at, product_version, sentiment, sentiment_score, topics, severity, ai_insight, is_recurring",
      )
      .single();
    if (error) throw new Error(error.message);

    if (related.length > 0) {
      await supabase.from("feedback_relationships").insert(
        related.map((r) => ({
          feedback_id: inserted.id,
          related_feedback_id: r.id,
          similarity_score: r.similarity,
          relationship_type:
            r.similarity >= RECURRING_THRESHOLD
              ? "recurring_issue"
              : r.sentiment !== analysis.sentiment
                ? "sentiment_shift"
                : "related_issue",
        })),
      );
    }

    return {
      feedback: inserted as FeedbackRow,
      related,
      isRecurring,
      insight,
    };
  });

export const semanticSearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ query: z.string().min(2).max(500) }).parse(data))
  .handler(async ({ data }): Promise<SimilarFeedback[]> => {
    const supabase = serverSupabase();
    const [embedding] = await embedTexts([data.query.trim()]);
    const { data: matches, error } = await supabase.rpc("match_feedback", {
      query_embedding: embedding as unknown as string,
      match_count: 12,
      exclude_id: null,
      min_similarity: 0.35,
    });
    if (error) throw new Error(error.message);
    return (matches ?? []) as SimilarFeedback[];
  });

export const findRelated = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<SimilarFeedback[]> => {
    const supabase = serverSupabase();
    const { data: row, error } = await supabase
      .from("feedback")
      .select("feedback_text")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const [embedding] = await embedTexts([row.feedback_text]);
    const { data: matches, error: matchError } = await supabase.rpc("match_feedback", {
      query_embedding: embedding as unknown as string,
      match_count: 6,
      exclude_id: data.id,
      min_similarity: 0.4,
    });
    if (matchError) throw new Error(matchError.message);
    return (matches ?? []) as SimilarFeedback[];
  });

/** One-off maintenance: generate embeddings for any feedback rows missing one. */
export const backfillEmbeddings = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = serverSupabase();
  const { data: rows, error } = await supabase
    .from("feedback")
    .select("id, feedback_text")
    .is("embedding", null)
    .limit(100);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return { updated: 0 };

  const vectors = await embedTexts(rows.map((r) => r.feedback_text));
  let updated = 0;
  for (let i = 0; i < rows.length; i++) {
    const { error: upErr } = await supabase
      .from("feedback")
      .update({ embedding: vectors[i] as unknown as string })
      .eq("id", rows[i].id);
    if (upErr) throw new Error(upErr.message);
    updated++;
  }
  return { updated };
});
