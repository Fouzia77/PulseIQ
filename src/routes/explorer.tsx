import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/pulse/AppShell";
import { SentimentBadge, SeverityBadge, TopicChip } from "@/components/pulse/badges";
import { allFeedbackQuery, topicStats } from "@/lib/feedback-queries";
import { semanticSearch } from "@/lib/pulse.functions";
import { relativeDate, type SimilarFeedback } from "@/lib/pulse-types";

export const Route = createFileRoute("/explorer")({
  head: () => ({
    meta: [
      { title: "Feedback Explorer — PulseIQ" },
      {
        name: "description",
        content:
          "Search every stored piece of feedback by meaning, then filter by sentiment, topic, source and date.",
      },
      { property: "og:title", content: "Feedback Explorer — PulseIQ" },
      {
        property: "og:description",
        content: "Semantic search across your feedback memory with sentiment, topic and source filters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allFeedbackQuery),
  component: Explorer,
});

const WINDOWS = [
  { label: "All time", days: 3650 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function Explorer() {
  const { data: rows } = useSuspenseQuery(allFeedbackQuery);
  const runSemantic = useServerFn(semanticSearch);

  const [query, setQuery] = useState("");
  const [sentiment, setSentiment] = useState("all");
  const [topic, setTopic] = useState("all");
  const [source, setSource] = useState("all");
  const [windowDays, setWindowDays] = useState(3650);
  const [semantic, setSemantic] = useState<SimilarFeedback[] | null>(null);

  const topics = useMemo(() => topicStats(rows).map((t) => t.topic), [rows]);
  const sources = useMemo(() => [...new Set(rows.map((r) => r.source))], [rows]);
  const scores = useMemo(
    () => new Map((semantic ?? []).map((s) => [s.id, s.similarity])),
    [semantic],
  );

  const search = useMutation({
    mutationFn: (q: string) => runSemantic({ data: { query: q } }),
    onSuccess: (data) => setSemantic(data),
  });

  const filtered = rows.filter((row) => {
    if (sentiment !== "all" && row.sentiment !== sentiment) return false;
    if (topic !== "all" && !(row.topics ?? []).includes(topic)) return false;
    if (source !== "all" && row.source !== source) return false;
    if (Date.now() - new Date(row.created_at).getTime() > windowDays * 86_400_000) return false;
    if (semantic) return scores.has(row.id);
    if (query.trim() && !row.feedback_text.toLowerCase().includes(query.trim().toLowerCase()))
      return false;
    return true;
  });

  const ordered = semantic
    ? [...filtered].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    : filtered;

  return (
    <AppShell signals={rows.length}>
      <div className="flex items-end justify-between pt-2">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Feedback Explorer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keyword filters, or search by meaning across the whole memory
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSemantic(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim().length > 1) search.mutate(query);
            }}
            placeholder="Search feedback…"
            className="min-w-64 flex-1 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
          />
          <button
            onClick={() => query.trim().length > 1 && search.mutate(query)}
            disabled={search.isPending}
            className="rounded-lg border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
          >
            {search.isPending ? "Searching…" : "Semantic search"}
          </button>
          {semantic && (
            <button
              onClick={() => setSemantic(null)}
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Select value={sentiment} onChange={setSentiment} label="Sentiment">
            {["positive", "neutral", "negative"]}
          </Select>
          <Select value={topic} onChange={setTopic} label="Topic">
            {topics}
          </Select>
          <Select value={source} onChange={setSource} label="Source">
            {sources}
          </Select>
          <div className="flex items-center gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                onClick={() => setWindowDays(w.days)}
                className={`rounded-full border px-3 py-1.5 transition-colors ${
                  windowDays === w.days
                    ? "border-accent/40 bg-accent/15 text-accent"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {search.isError && (
          <p className="mt-3 text-xs text-neg">
            {(search.error as Error)?.message ?? "Semantic search failed."}
          </p>
        )}
        {semantic && (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {ordered.length} semantically similar results, most similar first.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {ordered.map((row) => (
          <Link
            key={row.id}
            to="/feedback/$id"
            params={{ id: row.id }}
            className="glass rounded-2xl p-5 transition hover:border-accent/40"
          >
            <div className="mb-2 flex items-center gap-2">
              <SentimentBadge sentiment={row.sentiment} />
              <SeverityBadge severity={row.severity} />
              {scores.has(row.id) && (
                <span className="ml-auto text-[11px] text-accent">
                  {Math.round((scores.get(row.id) ?? 0) * 100)}% match
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/85">"{row.feedback_text}"</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(row.topics ?? []).map((t) => (
                <TopicChip key={t} topic={t} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {row.source} · {relativeDate(row.created_at)}
              </span>
              <span>{row.product_version ?? "—"}</span>
            </div>
          </Link>
        ))}
        {ordered.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-muted-foreground">
            No feedback matches these filters.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  children: string[];
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 text-muted-foreground">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-foreground capitalize focus:outline-none"
      >
        <option value="all" className="bg-popover">
          All
        </option>
        {children.map((option) => (
          <option key={option} value={option} className="bg-popover">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
