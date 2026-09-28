import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/pulse/AppShell";
import { SentimentBadge, SeverityBadge, TopicChip } from "@/components/pulse/badges";
import { allFeedbackQuery, feedbackByIdQuery, topicTrend } from "@/lib/feedback-queries";
import { findRelated } from "@/lib/pulse.functions";
import { relativeDate } from "@/lib/pulse-types";

export const Route = createFileRoute("/feedback/$id")({
  head: () => ({
    meta: [
      { title: "Feedback Detail — PulseIQ" },
      {
        name: "description",
        content:
          "AI analysis of a single piece of feedback with related historical complaints, similarity scores and a recurring-issue insight.",
      },
      { property: "og:title", content: "Feedback Detail — PulseIQ" },
      {
        property: "og:description",
        content: "Sentiment, topics, severity and the historical feedback this complaint echoes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(allFeedbackQuery),
      context.queryClient.ensureQueryData(feedbackByIdQuery(params.id)),
    ]),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { data: rows } = useSuspenseQuery(allFeedbackQuery);
  const { data: row } = useSuspenseQuery(feedbackByIdQuery(id));
  const fetchRelated = useServerFn(findRelated);

  const related = useQuery({
    queryKey: ["related", id],
    queryFn: () => fetchRelated({ data: { id } }),
  });

  const leadTopic = (row.topics ?? [])[0];
  const trend = leadTopic ? topicTrend(rows, leadTopic) : [];
  const recurring = row.is_recurring || (related.data ?? []).some((r) => r.similarity >= 0.72);

  return (
    <AppShell signals={rows.length}>
      <div className="flex items-center gap-3 pt-2">
        <Link to="/explorer" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to explorer
        </Link>
      </div>

      {recurring && (
        <div className="rounded-2xl border border-neg/30 bg-neg/10 p-5">
          <div className="text-xs font-semibold tracking-wider text-neg uppercase">
            🔴 Recurring issue
          </div>
          <p className="mt-2 text-sm">
            Very similar feedback already exists in memory
            {related.data?.[0] ? ` from ${relativeDate(related.data[0].created_at)}` : ""}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="glass col-span-2 rounded-2xl p-6">
          <div className="mb-3 flex items-center gap-2">
            <SentimentBadge sentiment={row.sentiment} />
            <SeverityBadge severity={row.severity} />
            <span className="text-[11px] text-muted-foreground">
              {row.source} · {row.customer_id ?? "anonymous"} · {row.product_version ?? "—"} ·{" "}
              {relativeDate(row.created_at)}
            </span>
          </div>
          <p className="text-lg leading-relaxed text-foreground/90">"{row.feedback_text}"</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(row.topics ?? []).map((t) => (
              <TopicChip key={t} topic={t} />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
            <Metric label="Sentiment score" value={row.sentiment_score.toFixed(2)} />
            <Metric label="Severity" value={row.severity} />
            <Metric
              label="Related in memory"
              value={related.isPending ? "…" : String(related.data?.length ?? 0)}
            />
          </div>

          {row.ai_insight && (
            <div className="mt-5 rounded-xl border border-accent/20 bg-accent/[0.06] p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-accent uppercase">
                <span className="size-1.5 rounded-full bg-accent" /> AI Insight
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{row.ai_insight}</p>
            </div>
          )}

          {leadTopic && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 text-[11px] tracking-wider text-muted-foreground uppercase">
                {leadTopic} sentiment over time
              </div>
              <div className="flex h-20 items-end gap-3">
                {trend.map((point) => (
                  <div key={point.label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-sm ${point.score < -0.2 ? "bg-neg" : point.score > 0.2 ? "bg-pos" : "bg-muted-foreground/50"}`}
                      style={{ height: `${Math.max(8, Math.abs(point.score) * 100)}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">{point.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="mb-3 font-display text-base font-semibold">Related Historical Feedback</h3>
          {related.isPending && (
            <p className="text-xs text-muted-foreground">Searching memory…</p>
          )}
          {related.isError && (
            <p className="text-xs text-neg">{(related.error as Error)?.message}</p>
          )}
          <div className="space-y-3">
            {(related.data ?? []).map((r) => (
              <Link
                key={r.id}
                to="/feedback/$id"
                params={{ id: r.id }}
                className="block rounded-lg border border-border bg-foreground/[0.03] p-3 transition hover:border-accent/40"
              >
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {relativeDate(r.created_at)} · {r.source} · {r.product_version ?? "—"}
                  </span>
                  <span className="font-medium text-accent">
                    {Math.round(r.similarity * 100)}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">"{r.feedback_text}"</p>
              </Link>
            ))}
            {related.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">No similar feedback in memory.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-foreground/[0.03] p-3">
      <div className="text-[10px] tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold capitalize">{value}</div>
    </div>
  );
}
