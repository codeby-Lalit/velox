import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ListTree,
  AlertTriangle,
  ClipboardCheck,
  Download,
  FileJson,
  FileText,
  ArrowLeft,
  RefreshCw,
  ArrowLeftRight,
  PenLine,
} from "lucide-react";
import { cn, downloadUrl } from "../lib/utils";
import IntegrityBanner from "../components/IntegrityBanner";
import StatsGrid from "../components/StatsGrid";
import StructureTree from "../components/StructureTree";
import IssuesList from "../components/IssuesList";
import ReviewQueue from "../components/ReviewQueue";
import CompareView from "../components/CompareView";
import MetaPanel from "../components/MetaPanel";
import { Badge } from "../components/ui/badge";

const TABS = [
  { id: "structure", label: "Structure", icon: ListTree, sub: "Detected hierarchy" },
  { id: "compare", label: "Before/After", icon: ArrowLeftRight, sub: "F104 · detect → format" },
  { id: "issues", label: "Issues", icon: AlertTriangle, sub: "Preflight findings" },
  { id: "review", label: "Review", icon: ClipboardCheck, sub: "F101 · editor decisions" },
];

export default function ResultsView({
  result,
  decisions,
  onDecision,
  onResetDecisions,
  onReProcess,
  onBack,
  onRunAgain,
  onEdit,
  busy,
}) {
  const [tab, setTab] = useState("structure");
  const [highlightIndex, setHighlightIndex] = useState(null);

  if (!result || !result.payload) {
    // R9 safe failure: a document that failed mid-pipeline has no payload to render.
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-2xl px-6 py-16"
      >
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold text-rose-300">
            This document could not be processed.
          </p>
          <p className="mt-2 text-xs text-slate-400">{result?.error || "Unknown pipeline failure."}</p>
          <button
            onClick={onBack}
            className="mt-6 inline-flex h-9 items-center gap-2 rounded-xl border border-line px-4 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </motion.div>
    );
  }

  const payload = result.payload;
  const stats = payload.processing_stats || {};
  const integrity = payload.integrity || {};
  const reviewItems = payload.review?.items || [];
  const issues = payload.preflight_issues || [];
  const outline = payload.structure_outline || [];
  const compareRows = payload.structure_view?.rows || [];
  const base = (payload.source?.path || "").split(/[\\/]/).pop().replace(/\.docx$/i, "") || "output";

  const locate = (sourceIndex) => {
    setHighlightIndex(sourceIndex);
    setTab("structure");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-5xl px-6 py-8"
    >
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-slate-400 hover:bg-white/[0.06] hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{base}</p>
          <p className="text-xs text-slate-500">
            Profile · {payload.profile || "default"} · {new Date(payload.generated_at).toLocaleString()}
          </p>
        </div>
        <Badge tone={integrity.status === "pass" ? "success" : "error"}>
          {integrity.status === "pass" ? "Verified" : "Failed"}
        </Badge>
        <button
          onClick={onRunAgain}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reprocess
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onEdit}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 text-xs font-bold text-ink-950 hover:brightness-110"
        >
          <PenLine className="h-3.5 w-3.5" /> Edit & refine
        </motion.button>
      </div>

      {/* Integrity */}
      <IntegrityBanner status={integrity.status} source={integrity} output={integrity} />

      {/* Download bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-ink-900/60 p-3">
        <span className="px-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Deliverables
        </span>
        <a
          href={downloadUrl(result.output_docx)}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 text-xs font-semibold text-ink-950 hover:brightness-110"
        >
          <FileText className="h-3.5 w-3.5" /> Publication DOCX
        </a>
        <a
          href={downloadUrl(result.audit_html)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3.5 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
        >
          <FileText className="h-3.5 w-3.5" /> Audit HTML
        </a>
        <a
          href={downloadUrl(result.audit_json)}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3.5 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
        >
          <FileJson className="h-3.5 w-3.5" /> Audit JSON
        </a>
        {result?.velox_docx && (
          <a
            href={downloadUrl(result.velox_docx)}
            title="Word document with embedded edit history (.velox)"
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-mint-400/15 px-3.5 text-xs font-semibold text-mint-300 hover:bg-mint-400/25"
          >
            <FileText className="h-3.5 w-3.5" /> Edit &amp; refine after download
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="mt-6">
        <StatsGrid stats={stats} />
      </div>

      {/* Main content */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {/* Tabs */}
          <div className="mb-4 flex gap-1.5 rounded-2xl border border-line bg-ink-900/60 p-1.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const count =
                t.id === "review"
                  ? reviewItems.length
                  : t.id === "issues"
                    ? issues.length
                    : t.id === "structure"
                      ? outline.length
                      : null;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors",
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-line"
                      transition={{ type: "spring", stiffness: 380, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 font-mono text-[10px]",
                          active ? "bg-aqua-400/20 text-aqua-300" : "bg-white/[0.08] text-slate-400"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "structure" && (
                <div className="glass rounded-2xl p-4">
                  <StructureTree outline={outline} highlightIndex={highlightIndex} />
                </div>
              )}
              {tab === "compare" && (
                <div className="glass rounded-2xl p-4">
                  <CompareView rows={compareRows} />
                </div>
              )}
              {tab === "issues" && (
                <div className="glass rounded-2xl p-4">
                  <IssuesList issues={issues} onLocate={locate} />
                </div>
              )}
              {tab === "review" && (
                <div>
                  <div className="mb-3 flex items-center justify-between px-1">
                    <p className="text-xs text-slate-500">
                      {reviewItems.length} item{reviewItems.length === 1 ? "" : "s"} below the
                      auto-approve threshold
                    </p>
                    {busy && <Badge tone="info">Re-analyzing…</Badge>}
                  </div>
                  <ReviewQueue
                    items={reviewItems}
                    decisions={decisions}
                    onDecision={onDecision}
                    onReset={onResetDecisions}
                    onCommit={onReProcess}
                  />
                </div>
              )}
              </motion.div>
          </AnimatePresence>
        </div>

        <aside className="space-y-6">
          <MetaPanel payload={payload} />
        </aside>
      </div>
    </motion.div>
  );
}