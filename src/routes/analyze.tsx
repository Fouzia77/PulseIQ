import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AppShell } from "@/components/pulse/AppShell";
import { SentimentBadge, SeverityBadge, TopicChip } from "@/components/pulse/badges";
import { allFeedbackQuery } from "@/lib/feedback-queries";
import { submitFeedback } from "@/lib/pulse.functions";
import { relativeDate, SOURCES, type AnalysisResult } from "@/lib/pulse-types";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze New Feedback — PulseIQ" },
      {
        name: "description",
        content:
          "Submit a new complaint and watch PulseIQ detect sentiment, extract topics, search its memory and reveal whether the issue is recurring.",
      },
      { property: "og:title", content: "Analyze New Feedback — PulseIQ" },
      {
        property: "og:description",
        content:
          "AI analysis of a new complaint against months of stored feedback, with recurring-issue detection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(allFeedbackQuery),
  component: Analyze,
});

function Analyze() {
  const { data: rows } = useSuspenseQuery(allFeedbackQuery);
  const queryClient = useQueryClient();
  const submit = useServerFn(submitFeedback);

  const [text, setText] = useState("");
  const [source, setSource] = useState<string>("Support Tickets");
  const [version, setVersion] = useState("v2.8");
  const [customer, setCustomer] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          text,
          source,
          productVersion: version || undefined,
          customerId: customer || undefined,
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });

  return (
    <AppShell signals={rows.length}>
      <div className="pt-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">Analyze New Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every submission is embedded, compared against the full history, and stored in memory
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="glass col-span-2 rounded-2xl p-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="The navigation is extremely slow again. Moving between dashboard pages takes several seconds."
            className="w-full resize-none rounded-xl border border-border bg-foreground/[0.03] p-4 text-sm leading-relaxed placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 text-muted-foreground">
              Source
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="bg-transparent text-foreground focus:outline-none"
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s} className="bg-popover">
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Version"
              className="w-28 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
            />
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="Customer (optional)"
              className="w-44 rounded-full border border-border bg-foreground/[0.03] px-3 py-1.5 placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
            />
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || text.trim().length < 5}
              className="ml-auto rounded-full border border-accent/40 bg-accent/15 px-5 py-2 font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
            >
              {mutation.isPending ? "Analyzing memory…" : "Analyze feedback"}
            </button>
          </div>
          {mutation.isError && (
            <p className="mt-3 text-xs text-neg">
              {(mutation.error as Error)?.message ?? "Analysis failed."}
            </p>
          )}
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-base font-semibold">Pipeline</h2>
          <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
            {[
              "Clean the text",
              "AI sentiment + topic extraction",
              "Generate embedding",
              "Vector search over history",
              "Recurring-issue detection",
              "AI insight generation",
              "Store in memory",
            ].map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-[10px] text-accent">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {result && (
        <>
          {result.isRecurring && (
            <div className="rounded-2xl border border-neg/30 bg-neg/10 p-5">
              <div className="text-xs font-semibold tracking-wider text-neg uppercase">
                🔴 Recurring issue detected
              </div>
              <p className="mt-2 text-sm">
                This complaint is highly similar to feedback reported{" "}
                {relativeDate(result.related[0].created_at)} via {result.related[0].source}.
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="glass col-span-2 rounded-2xl p-6">
              <div className="mb-3 flex items-center gap-2">
                <SentimentBadge sentiment={result.feedback.sentiment} />
                <SeverityBadge severity={result.feedback.severity} />
                <span className="text-[11px] text-muted-foreground">
                  {result.feedback.source} · {result.feedback.product_version ?? "—"} · just now
                </span>
              </div>
              <p className="text-lg leading-relaxed text-foreground/90">
                "{result.feedback.feedback_text}"
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(result.feedback.topics ?? []).map((t) => (
                  <TopicChip key={t} topic={t} />
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-accent/20 bg-accent/[0.06] p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wider text-accent uppercase">
                  <span className="size-1.5 rounded-full bg-accent" /> AI Insight
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{result.insight}</p>
              </div>
              <Link
                to="/feedback/$id"
                params={{ id: result.feedback.id }}
                className="mt-4 inline-block text-xs text-accent hover:underline"
              >
                Open full detail →
              </Link>
            </div>

            <div className="glass rounded-2xl p-6">
              <h3 className="mb-3 font-display text-base font-semibold">
                Related Historical Feedback
              </h3>
              <div className="space-y-3">
                {result.related.map((r) => (
                  <Link
                    key={r.id}
                    to="/feedback/$id"
                    params={{ id: r.id }}
                    className="block rounded-lg border border-border bg-foreground/[0.03] p-3 transition hover:border-accent/40"
                  >
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {relativeDate(r.created_at)} · {r.source}
                      </span>
                      <span className="font-medium text-accent">
                        {Math.round(r.similarity * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">"{r.feedback_text}"</p>
                  </Link>
                ))}
                {result.related.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nothing similar in memory yet — this looks like a new issue.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
