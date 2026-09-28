import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const EMBED_MODEL = "google/gemini-embedding-2";
const EMBED_DIMS = 1536;
const CHAT_MODEL = "google/gemini-3.8-flash";

export function serverSupabase() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!;
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function aiHeaders() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this project.");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "X-Lovable-AIG-SDK": "fetch",
  };
}

function gatewayError(status: number, body: string): Error {
  if (status === 402) return new Error("AI credits are exhausted. Please top up to continue.");
  if (status === 429) return new Error("Too many requests right now — try again in a moment.");
  if (status === 401 || status === 403)
    return new Error("AI access is not available for this project right now.");
  return new Error(`AI request failed (${status}): ${body.slice(0, 200)}`);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 16) {
    const batch = texts.slice(i, i + 16);
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({ model: EMBED_MODEL, input: batch, dimensions: EMBED_DIMS }),
    });
    if (!res.ok) throw gatewayError(res.status, await res.text());
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    const sorted = [...json.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

async function chat(system: string, user: string, json: boolean): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: aiHeaders(),
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text());
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export interface TextAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  sentiment_score: number;
  topics: string[];
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
}

export async function analyzeText(text: string): Promise<TextAnalysis> {
  const system = [
    "You analyse B2B product feedback. Respond with JSON only.",
    "Fields: sentiment (positive|neutral|negative), sentiment_score (number between -1 and 1),",
    "topics (array of 1-3 short Title Case topic labels; prefer Navigation, Performance, UI, Authentication, Payments, Search, Notifications, Bugs, Feature Requests, but invent a new label when none fit),",
    "severity (low|medium|high|critical), summary (one short sentence describing the issue).",
  ].join(" ");
  const raw = await chat(system, text, true);
  let parsed: Partial<TextAnalysis> = {};
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?/i, "").replace(/```$/, "")) as TextAnalysis;
  } catch {
    parsed = {};
  }
  const sentiment = ["positive", "neutral", "negative"].includes(String(parsed.sentiment))
    ? (parsed.sentiment as TextAnalysis["sentiment"])
    : "neutral";
  const severity = ["low", "medium", "high", "critical"].includes(String(parsed.severity))
    ? (parsed.severity as TextAnalysis["severity"])
    : "low";
  const score = Number(parsed.sentiment_score);
  return {
    sentiment,
    sentiment_score: Number.isFinite(score) ? Math.max(-1, Math.min(1, score)) : 0,
    topics: Array.isArray(parsed.topics)
      ? parsed.topics.filter((t) => typeof t === "string").slice(0, 3)
      : [],
    severity,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function generateInsight(payload: {
  text: string;
  analysis: TextAnalysis;
  related: { text: string; date: string; source: string; similarity: number; sentiment: string }[];
  releases: { version: string; release_date: string; description: string | null }[];
  isRecurring: boolean;
}): Promise<string> {
  const system = [
    "You are a product analyst writing one short paragraph (2-3 sentences) for a feedback dashboard.",
    "Explain whether the new feedback is a recurring issue, referencing when similar feedback was reported and how sentiment has moved.",
    "You may mention that complaints resurfaced around a release window, but never claim a specific release caused a regression unless the data clearly supports it — hedge instead.",
    "No bullet points, no headings, no markdown.",
  ].join(" ");
  const user = JSON.stringify(payload);
  const out = await chat(system, user, false);
  return out.trim();
}
