import { cn } from "@/lib/utils";

const SENTIMENT_STYLES: Record<string, string> = {
  positive: "bg-pos/15 text-pos",
  negative: "bg-neg/15 text-neg",
  neutral: "bg-foreground/10 text-muted-foreground",
};

export function SentimentBadge({ sentiment, className }: { sentiment: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        SENTIMENT_STYLES[sentiment] ?? SENTIMENT_STYLES.neutral,
        className,
      )}
    >
      {sentiment}
    </span>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-neg/40 text-neg",
  high: "border-neg/30 text-neg",
  medium: "border-warn/30 text-warn",
  low: "border-accent/30 text-accent",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low,
      )}
    >
      {severity}
    </span>
  );
}

export function TopicChip({ topic }: { topic: string }) {
  return (
    <span className="rounded-full border border-border bg-foreground/[0.03] px-2 py-0.5 text-[11px] text-muted-foreground">
      {topic}
    </span>
  );
}
