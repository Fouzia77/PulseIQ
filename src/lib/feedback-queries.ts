import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { FeedbackRow } from "./pulse-types";

const SELECT =
  "id, feedback_text, customer_id, source, created_at, product_version, sentiment, sentiment_score, topics, severity, ai_insight, is_recurring";

export const allFeedbackQuery = queryOptions({
  queryKey: ["feedback", "all"],
  queryFn: async (): Promise<FeedbackRow[]> => {
    const { data, error } = await supabase
      .from("feedback")
      .select(SELECT)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as FeedbackRow[];
  },
});

export const feedbackByIdQuery = (id: string) =>
  queryOptions({
    queryKey: ["feedback", id],
    queryFn: async (): Promise<FeedbackRow> => {
      const { data, error } = await supabase.from("feedback").select(SELECT).eq("id", id).single();
      if (error) throw new Error(error.message);
      return data as FeedbackRow;
    },
  });

export interface TopicStat {
  topic: string;
  count: number;
  negative: number;
  score: number;
}

export function topicStats(rows: FeedbackRow[]): TopicStat[] {
  const map = new Map<string, { count: number; negative: number; total: number }>();
  for (const row of rows) {
    for (const topic of row.topics ?? []) {
      const entry = map.get(topic) ?? { count: 0, negative: 0, total: 0 };
      entry.count += 1;
      entry.total += row.sentiment_score;
      if (row.sentiment === "negative") entry.negative += 1;
      map.set(topic, entry);
    }
  }
  return [...map.entries()]
    .map(([topic, e]) => ({
      topic,
      count: e.count,
      negative: e.negative,
      score: e.total / e.count,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Topics whose mentions are concentrated in the most recent third of the window. */
export function emergingTopics(rows: FeedbackRow[]): string[] {
  const cutoff = Date.now() - 30 * 86_400_000;
  const recent = topicStats(rows.filter((r) => new Date(r.created_at).getTime() >= cutoff));
  const older = new Map(
    topicStats(rows.filter((r) => new Date(r.created_at).getTime() < cutoff)).map((t) => [
      t.topic,
      t.count,
    ]),
  );
  return recent.filter((t) => t.count > (older.get(t.topic) ?? 0)).map((t) => t.topic);
}

export interface TrendPoint {
  label: string;
  score: number;
  count: number;
}

/** Monthly average sentiment for a topic across the last 4 months. */
export function topicTrend(rows: FeedbackRow[], topic: string): TrendPoint[] {
  const buckets: TrendPoint[] = [];
  for (let i = 3; i >= 0; i--) {
    const end = Date.now() - i * 30 * 86_400_000;
    const start = end - 30 * 86_400_000;
    const inBucket = rows.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t > start && t <= end && (r.topics ?? []).includes(topic);
    });
    buckets.push({
      label: i === 0 ? "Now" : `${i}m ago`,
      score: inBucket.length
        ? inBucket.reduce((a, r) => a + r.sentiment_score, 0) / inBucket.length
        : 0,
      count: inBucket.length,
    });
  }
  return buckets;
}
