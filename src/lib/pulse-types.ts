export type Sentiment = "positive" | "neutral" | "negative";
export type Severity = "low" | "medium" | "high" | "critical";

export interface FeedbackRow {
  id: string;
  feedback_text: string;
  customer_id: string | null;
  source: string;
  created_at: string;
  product_version: string | null;
  sentiment: string;
  sentiment_score: number;
  topics: string[];
  severity: string;
  ai_insight: string | null;
  is_recurring: boolean;
}

export interface SimilarFeedback {
  id: string;
  feedback_text: string;
  customer_id: string | null;
  source: string;
  created_at: string;
  product_version: string | null;
  sentiment: string;
  sentiment_score: number;
  topics: string[];
  severity: string;
  similarity: number;
}

export interface AnalysisResult {
  feedback: FeedbackRow;
  related: SimilarFeedback[];
  isRecurring: boolean;
  insight: string;
}

export const SOURCES = [
  "Intercom",
  "Discord",
  "Jira",
  "Beta Testing",
  "Support Tickets",
] as const;

export function relativeDate(iso: string): string {
  const days = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months <= 1 ? "1 month ago" : `${months} months ago`;
}
