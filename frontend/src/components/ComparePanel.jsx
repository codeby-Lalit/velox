import { motion } from "framer-motion";
import {
  GitCompareArrows,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

/* F200: before-vs-after content preservation panel.
   Proves the original manuscript's word content is untouched (R3) — only
   structure & typography were corrected — by comparing the raw document
   ("before", captured before edits/formatting) with the formatted result. */
const join = (...parts) => parts.filter(Boolean).join(" · ");

const ROWS = [
  { label: "Total words", before: "words", after: "words" },
  { label: "Characters", before: "characters", after: "characters", noWs: true },
  { label: "Paragraphs", before: "paragraphs", after: "paragraphs" },
  { label: "Non-empty paragraphs", before: "non_empty_paragraphs", after: "non_empty_paragraphs" },
  { label: "Headings", before: "headings", after: "headings" },
  { label: "Captions", before: "captions", after: "captions" },
  { label: "Tables", before: "tables", after: "tables" },
  { label: "Table cells", before: "table_cells", after: "table_cells" },
  { label: "Page headers", before: "headers", after: "headers" },
  { label: "Page footers", before: "footers", after: "footers" },
  { label: "Estimated pages", before: "pages_estimate", after: "pages_estimate" },
];

const fmt = (v) => (typeof v === "number" ? v.toLocaleString("en-US") : "—");

function Matrix({ rows }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-1 ring-line">
      <div className="grid grid-cols-[minmax(0,1fr)_5rem_1rem_5rem_4rem] items-center gap-1 border-b border-line bg-white/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Metric</span>
        <span className="text-right">Before</span>
        <span />
        <span className="text-right">After</span>
        <span className="text-right">Δ</span>
      </div>
      {rows.map((row) => {
        const b = row.b;
        const a = row.a;
        const same = b === a;
        const delta = typeof b === "number" && typeof a === "number" ? a - b : 0;
        const deltaLabel = same
          ? "="
          : delta
            ? delta > 0
              ? "+" + delta
              : String(delta)
            : "—";
        const good =
          same || (row.betterWhen === "down" ? delta < 0 : delta === 0);
        return (
          <div
            key={row.label}
            className="grid grid-cols-[minmax(0,1fr)_5rem_1rem_5rem_4rem] items-center gap-1 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <span className="truncate text-[12px] font-medium text-slate-300">{row.label}</span>
            <span className="text-right font-mono text-[12px] text-slate-400">{fmt(b)}</span>
            <ArrowRight className="h-3 w-3 text-slate-400" />
            <span className="text-right font-mono text-[12px] font-semibold text-ink-900">{fmt(a)}</span>
            <span
              className={cn(
                "text-right font-mono text-[11px]",
                good ? "text-mint-300" : "text-amber-300"
              )}
            >
              {deltaLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ComparePanel({ payload, history, liveStats, liveIssues = [], onClose }) {
  const source = payload?.source || {};
  const before = payload?.source_stats || {};
  // "after" = pipeline result overlaid with LIVE re-derived stats, so staged
  // overrides (role / text fixes) move the matrix before anything is committed.
  const after = { ...(payload?.processing_stats || {}), ...(liveStats || {}) };
  const integrity = payload?.integrity || {};
  const pass = integrity.status === "pass";
  const meta = source.metadata || {};
  const title = before.title || meta.title || source.path?.split(/[\\/]/).pop() || "document";
  const wordDelta = (after.words ?? 0) - (before.words ?? 0);
  const preserved = wordDelta === 0;
  const sha = source.sha256 || "";
  const created =
    meta.created && !meta.created.startsWith("0001") ? new Date(meta.created).getFullYear() : null;

  // "Characters" intentionally excludes whitespace (formatting-only fixes such as
  // double-space collapses must not look like content changes) — R3 content view.
  const resolve = (o, key, noWs) =>
    noWs && key === "characters"
      ? o.characters_no_ws ?? o.characters
      : o[key];

  const contentRows = ROWS.map((r) => ({
    label: r.label,
    b: resolve(before, r.before, r.noWs),
    a: resolve(after, r.after, r.noWs),
  }));

  /* "Before" issue counts = the pristine pipeline round (history v0), so the
     delta survives later commits — every staged/committed fix keeps shrinking
     the "after" side. Fall back to source_stats.issues when v0 has no stats. */
  const tallyOf = (o) => {
    if (!o) return null;
    const errs =
      typeof o.preflight_errors === "number" ? o.preflight_errors : o.errors;
    const warns =
      typeof o.preflight_warnings === "number" ? o.preflight_warnings : o.warnings;
    const infos = typeof o.preflight_info === "number" ? o.preflight_info : o.info;
    if (errs === undefined && warns === undefined && infos === undefined) return null;
    return {
      total: (errs || 0) + (warns || 0) + (infos || 0),
      errors: errs || 0,
      warnings: warns || 0,
      info: infos || 0,
    };
  };
  const beforeMap = tallyOf(history?.versions?.[0]?.stats) || tallyOf(before.issues) || null;
  const liveMap = { errors: 0, warnings: 0, info: 0 };
  for (const i of liveIssues) {
    if (i.severity === "error") liveMap.errors += 1;
    else if (i.severity === "warning") liveMap.warnings += 1;
    else liveMap.info += 1;
  }
  const afterMap = tallyOf(liveMap);
  const hasIssueBefore = beforeMap != null;
  const hasIssueAfter = afterMap != null;
  const fixedByPipeline =
    hasIssueBefore && hasIssueAfter
      ? Math.max(0, (beforeMap.total ?? 0) - (afterMap.total ?? 0))
      : null;
  const issueRows = [
    { label: "Issues found", b: beforeMap?.total, a: afterMap?.total, betterWhen: "down" },
    { label: "Errors", b: beforeMap?.errors, a: afterMap?.errors, betterWhen: "down" },
    { label: "Warnings", b: beforeMap?.warnings, a: afterMap?.warnings, betterWhen: "down" },
    { label: "Info", b: beforeMap?.info, a: afterMap?.info, betterWhen: "down" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-ink-700/30 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        role="dialog"
        aria-modal="true"
        aria-label="Before vs after comparison"
        className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl glass-strong shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-line bg-white/70 px-5 py-4 backdrop-blur">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-iris-400/12 text-iris-300 ring-1 ring-iris-400/25">
            <GitCompareArrows className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Before vs After</p>
            <p className="truncate text-[11px] text-slate-400">
              {join(before.title || meta.title || title, meta.author, created)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone="accent">{payload?.profile || "default"}</Badge>
            <Badge tone={pass ? "success" : "error"}>
              {pass ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
              {pass ? "Verified" : "Failed"}
            </Badge>
            <button
              onClick={onClose}
              aria-label="Close comparison"
              className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/25 hover:text-ink-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {/* Verdict */}
          <div
            className={cn(
              "mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3",
              preserved
                ? "border-mint-400/30 bg-mint-400/10"
                : "border-amber-400/30 bg-amber-400/10"
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full",
                preserved ? "bg-mint-400/20 text-mint-300" : "bg-amber-400/20 text-amber-300"
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className={cn("text-[13px] font-semibold", preserved ? "text-mint-300" : "text-amber-300")}>
                {preserved
                  ? "Your content is fully preserved"
                  : "Content re-scaled by your manual edits"}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                {preserved
                  ? "Every word of the original manuscript is untouched (R3). Only structure, numbering, spacing & typography were corrected."
                  : (() => {
                      const n = Math.abs(wordDelta).toLocaleString("en-US");
                      const w = Math.abs(wordDelta) === 1 ? " word" : " words";
                      return (wordDelta > 0 ? n + w + " added" : n + w + " changed") +
                        " by your edits — everything else in the original is preserved.";
                    })()}
              </p>
            </div>
          </div>

          {/* Comparison matrix */}
          <Matrix rows={contentRows} />

          {/* Compliance: issues before vs after */}
          {(hasIssueBefore || hasIssueAfter) && (
            <div className="mt-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Compliance — issues before vs after
                </p>
                {fixedByPipeline != null && fixedByPipeline > 0 && (
                  <span className="rounded-full bg-mint-400/15 px-2 py-0.5 text-[10px] font-semibold text-mint-300">
                    {"+" + fixedByPipeline + " resolved"}
                  </span>
                )}
              </div>
              <Matrix rows={issueRows} />
              <p className="mt-2 text-[11px] text-slate-500">
                Pristine pipeline findings vs the live state — role picks and
                Auto-Fix updates the "after" column instantly, even before you commit.
              </p>
            </div>
          )}

          {/* Fingerprint + guarantees */}
          <div className="mt-4 rounded-2xl bg-white/55 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Source fingerprint
            </p>
            <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{sha || "—"}</p>
            <ul className="mt-3 space-y-1.5 text-[11px] leading-snug text-slate-300">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint-300" />
                No content rewritten — original text kept verbatim (R3).
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint-300" />
                SHA-256 fingerprint of the source verified against the output (R4/R8).
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-mint-300" />
                Structure, numbering, spacing & typography corrected by the
                {payload?.profile ? " \"" + payload.profile + "\"" : ""} publisher profile.
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}