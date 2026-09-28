import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/pulse/AppShell";
import { SentimentBadge, SeverityBadge } from "@/components/pulse/badges";
import {
  allFeedbackQuery,
  emergingTopics,
  topicStats,
  topicTrend,
} from "@/lib/feedback-queries";
import { relativeDate } from "@/lib/pulse-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PulseIQ — Feedback Intelligence Dashboard" },
      {
        name: "description",
        content:
          "PulseIQ remembers user feedback over time, detects recurring issues with semantic search, and tracks sentiment trends across Intercom, Discord, Jira and support tickets.",
      },
      { property: "og:title", content: "PulseIQ — Feedback Intelligence Dashboard" },
      {
        property: "og:description",
        content:
          "Persistent AI memory for user feedback: sentiment, topics, recurring-issue detection and product insight.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allFeedbackQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data: rows } = useSuspenseQuery(allFeedbackQuery);

  const total = rows.length;
  const negative = rows.filter((r) => r.sentiment === "negative").length;
  const neutral = rows.filter((r) => r.sentiment === "neutral").length;
  const positive = total - negative - neutral;
  const stats = topicStats(rows);
  const recurring = stats.filter((t) => t.count >= 3 && t.negative >= 2);
  const emerging = emergingTopics(rows);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const leadTopic = stats[0]?.topic ?? "Navigation";
  const trend = topicTrend(rows, leadTopic);
  const recent = rows.slice(0, 3);

  return (
    <AppShell signals={total}>
      <div className="flex items-end justify-between pt-2">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Feedback Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Persistent sentiment memory across {new Set(rows.map((r) => r.source)).size} feedback
            sources · last 3 months
          </p>
        </div>
        <Link
          to="/analyze"
          className="rounded-full border border-accent/40 bg-accent/15 px-4 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
        >
          Add feedback
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Feedback" value={String(total)} hint="stored with embeddings" />
        <StatCard
          label="Negative Feedback"
          value={String(negative)}
          hint={`${pct(negative)}% of all signals`}
          tone="neg"
        />
        <StatCard
          label="Recurring Issues"
          value={String(recurring.length)}
          hint={recurring[0] ? `${recurring[0].topic} leads` : "none detected"}
          tone="warn"
        />
        <StatCard
          label="Emerging Topics"
          value={String(emerging.length)}
          hint={emerging[0] ? `${emerging[0]} rising` : "steady"}
          tone="accent"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass col-span-1 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Sentiment Distribution</h2>
            <span className="text-[11px] text-muted-foreground">{total} items</span>
          </div>
          <div className="mt-6 space-y-4">
            <Bar label="Positive" tone="pos" count={positive} pct={pct(positive)} />
            <Bar label="Neutral" tone="muted" count={neutral} pct={pct(neutral)} />
            <Bar label="Negative" tone="neg" count={negative} pct={pct(negative)} />
          </div>
          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-2 text-[11px] tracking-wider text-muted-foreground uppercase">
              {leadTopic} sentiment · 4 months
            </div>
            <div className="flex h-16 items-end gap-2">
              {trend.map((point) => (
                <div key={point.label} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-sm ${point.score < -0.2 ? "bg-neg" : point.score > 0.2 ? "bg-pos" : "bg-muted-foreground/50"}`}
                    style={{ height: `${Math.max(8, Math.abs(point.score) * 100)}%` }}
                  />
                  <span className="text-[9px] text-muted-foreground">{point.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="glass col-span-2 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Top Issues</h2>
            <span className="text-[11px] text-muted-foreground">Ranked by mention volume</span>
          </div>
          <div className="mt-4 divide-y divide-border">
            {stats.slice(0, 4).map((topic, index) => {
              const width = Math.round((topic.count / (stats[0]?.count || 1)) * 100);
              const tone =
                topic.score < -0.4 ? "bg-neg" : topic.score < 0 ? "bg-warn" : "bg-accent";
              return (
                <div key={topic.topic} className="flex items-center gap-4 py-3">
                  <span className="w-6 font-display text-lg font-bold text-muted-foreground/60">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{topic.topic}</div>
                    <div className="text-xs text-muted-foreground">
                      {topic.count} mentions · {topic.negative} negative
                    </div>
                  </div>
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-foreground/5">
                    <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs text-muted-foreground">
                    {topic.score.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recurring-Issue Alerts</h2>
          <span className="text-[11px] text-muted-foreground">
            Detected from repeated topics and semantic matches
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {recurring.slice(0, 3).map((topic) => (
            <div key={topic.topic} className="rounded-xl border border-neg/25 bg-neg/10 p-4">
              <div className="text-xs font-semibold tracking-wider text-neg uppercase">
                Recurring
              </div>
              <div className="mt-2 text-sm font-medium">{topic.topic}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {topic.count} mentions · {topic.negative} negative · avg sentiment{" "}
                {topic.score.toFixed(2)}
              </div>
            </div>
          ))}
          {emerging.slice(0, 3 - Math.min(3, recurring.length)).map((topic) => (
            <div key={topic} className="rounded-xl border border-warn/25 bg-warn/10 p-4">
              <div className="text-xs font-semibold tracking-wider text-warn uppercase">
                Emerging
              </div>
              <div className="mt-2 text-sm font-medium">{topic}</div>
              <div className="mt-1 text-xs text-muted-foreground">Rising in the last 30 days</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Latest Feedback</h2>
          <Link to="/explorer" className="text-xs text-accent hover:underline">
            Open explorer
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {recent.map((row) => (
            <Link
              key={row.id}
              to="/feedback/$id"
              params={{ id: row.id }}
              className="rounded-xl border border-border bg-foreground/[0.03] p-4 transition hover:border-accent/40"
            >
              <div className="mb-2 flex items-center gap-2">
                <SentimentBadge sentiment={row.sentiment} />
                <span className="text-[11px] text-muted-foreground">
                  {(row.topics ?? [])[0] ?? "General"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">"{row.feedback_text}"</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {relativeDate(row.created_at)} · {row.source}
                </span>
                <SeverityBadge severity={row.severity} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neg" | "warn" | "accent";
}) {
  const toneClass =
    tone === "neg"
      ? "text-neg"
      : tone === "warn"
        ? "text-warn"
        : tone === "accent"
          ? "text-accent"
          : "text-foreground";
  return (
    <div className="glass diag rounded-2xl p-5">
      <div className="text-xs tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className={`mt-2 font-display text-4xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}

function Bar({
  label,
  count,
  pct,
  tone,
}: {
  label: string;
  count: number;
  pct: number;
  tone: "pos" | "neg" | "muted";
}) {
  const text = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-muted-foreground";
  const fill = tone === "pos" ? "bg-pos" : tone === "neg" ? "bg-neg" : "bg-muted-foreground/60";
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className={text}>{label}</span>
        <span className="text-muted-foreground">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-foreground/5">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
