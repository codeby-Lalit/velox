import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  LocateFixed,
  Wand2,
  RefreshCw,
  PenLine,
  Eye,
  Download,
  FileText,
  FileJson,
  Send,
  Loader2,
  Gauge,
  CheckCircle2,
  LayoutPanelLeft,
  X,
} from "lucide-react";
import { cn, downloadUrl } from "../lib/utils";
import {
  SEVERITY_META,
  CATEGORY_META,
  CATEGORY_ORDER,
  SEVERITY_ORDER,
  issueIsResolved,
  isFixable,
  isReviewable,
  buildEdits,
  autoFixAll,
} from "../lib/issues";
import { Badge } from "../components/ui/badge";
import AccuracyRing from "../components/AccuracyRing";
import ResizeSplit from "../components/ResizeSplit";
import DocEditor from "../components/DocEditor";
import DocPreview from "../components/DocPreview";

const FILTER_ICONS = { error: AlertCircle, warning: AlertTriangle, info: Info };

export default function WorkspaceView({
  result,
  onApply,
  onReanalyze = () => {},
  onBack,
  onRunAgain,
  busy,
  restoringId,
}) {
  const payload = result?.payload || {};
  const stats = payload.processing_stats || {};
  const [overrides, setOverrides] = useState({});
  const [decisions, setDecisions] = useState({});
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [activeIndex, setActiveIndex] = useState(null);
  const [focusIndex, setFocusIndex] = useState(null);
  const [focusSerial, setFocusSerial] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [rightMode, setRightMode] = useState("edit");
  const [confirming, setConfirming] = useState(false);
  const [exportsOpen, setExportsOpen] = useState(false);
  const serialRef = useRef(0);

  const elements = payload.document_view || [];
  const issues = payload.preflight_issues || [];
  const integrity = payload.integrity || {};
  const byIndex = useMemo(
    () => new Map(elements.map((el) => [el.source_index, el])),
    [elements]
  );

  /* ---- optimistic re-audit ------------------------------------------------- */
  const liveIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (issue.source_index < 0) return true;
      return !issueIsResolved(
        issue,
        byIndex.get(issue.source_index),
        overrides[issue.source_index],
        decisions
      );
    });
  }, [issues, overrides, decisions, byIndex]);

  const issuesByElement = useMemo(() => {
    const map = {};
    for (const it of liveIssues) {
      if (typeof it.source_index !== "number" || it.source_index < 0) continue;
      (map[it.source_index] ||= []).push(it);
    }
    return map;
  }, [liveIssues]);

  const filtered = useMemo(
    () =>
      liveIssues.filter(
        (i) =>
          (category === "all" || i.category === category) &&
          (severity === "all" || i.severity === severity)
      ),
    [liveIssues, category, severity]
  );

  const counts = useMemo(() => {
    const by = { error: 0, warning: 0, info: 0 };
    for (const i of liveIssues) by[i.severity] = (by[i.severity] || 0) + 1;
    return by;
  }, [liveIssues]);

  const catCounts = useMemo(() => {
    const by = {};
    for (const i of liveIssues) by[i.category] = (by[i.category] || 0) + 1;
    return by;
  }, [liveIssues]);

  const fixableCount = useMemo(
    () => liveIssues.filter((i) => isFixable(i)).length,
    [liveIssues]
  );

  const liveAccuracy = useMemo(() => {
    let score = 100;
    for (const i of liveIssues) {
      score -= i.severity === "error" ? 5 : i.severity === "warning" ? 2 : 0.25;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [liveIssues]);

  const edits = useMemo(() => buildEdits(overrides, elements), [overrides, elements]);
  const base = (payload.source?.path || "").split(/[\\/]/).pop().replace(/\.docx$/i, "") || "document";

  /* ---- actions ------------------------------------------------------------- */
  const applyNow = async ({ auto = false } = {}) => {
    if (!edits.length) return;
    setConfirming(true);
    try {
      await onApply({
        edits,
        message: message.trim() || (auto ? "background re-scan" : `manual edits (${edits.length})`),
      });
    } catch {
      // App.jsx already routes to the error phase and shows the banner; the
      // workspace unmounts, so there is nothing else to do here.
    } finally {
      setConfirming(false);
      setOverrides({});
      setMessage("");
    }
  };

  const reScan = () => applyNow({ auto: true });

  const handleAutoFixAll = () => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const [idx, fix] of Object.entries(autoFixAll(liveIssues, byIndex))) {
        next[idx] = { ...(next[idx] || {}), ...fix };
      }
      return next;
    });
  };

  const handleDecide = (idx, action) => {
    setDecisions((prev) => ({
      ...prev,
      [idx]: { source_index: idx, action, new_element_type: null },
    }));
  };

  const reviewQueue = useMemo(() => Object.values(decisions), [decisions]);

  const locate = (idx) => {
    setActiveIndex(idx);
    setFocusIndex(idx);
    setFocusSerial((s) => s + 1);
  };

  const patch = (idx, patch) => {
    setOverrides((prev) => {
      const copy = { ...prev };
      const el = byIndex.get(idx);
      const baseRole = el?.element_type;
      const baseText = el?.text;
      const merged = { ...(copy[idx] || {}) };
      if (patch.text !== undefined) {
        if (patch.text === baseText) delete merged.text;
        else merged.text = patch.text;
      }
      if (patch.element_type !== undefined) {
        if (patch.element_type === baseRole) delete merged.element_type;
        else merged.element_type = patch.element_type;
      }
      const isEmpty = Object.keys(merged).length === 0;
      if (isEmpty) delete copy[idx];
      else copy[idx] = merged;
      return copy;
    });
  };

  const veloxName = result?.velox_docx
    ? result.velox_docx.split(/[\\/]/).pop()
    : `${base}_velox.docx`;

  /* ---- render -------------------------------------------------------------- */
  return (
    <div className="circuit-bg relative flex h-screen w-full flex-col">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      {/* Top bar */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink-950/80 px-4 backdrop-blur-xl">
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={onBack}
          className="neu-chip inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </motion.button>

        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="min-w-0"
        >
          <p className="truncate text-[14px] font-semibold text-white leading-tight">{base}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={cn("h-1.5 w-1.5 rounded-full", liveAccuracy >= 90 ? "bg-mint-400" : "bg-amber-400")} />
            {payload.profile || "default"} · {new Date(payload.generated_at).toLocaleString()}
          </p>
        </motion.div>

        <div className="mx-2 hidden h-6 w-px bg-line md:block" />

        <div className="hidden items-center gap-1.5 md:flex">
          <Badge tone={integrity.status === "pass" ? "success" : "error"}>
            {integrity.status === "pass" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {integrity.status === "pass" ? "Verified" : "Failed"}
          </Badge>
          <Badge tone="info">
            <Gauge className="h-3 w-3" /> {stats.rules_checked ?? 24} rules
          </Badge>
          <Badge tone="neutral">{stats.pages_estimate ?? 1} pgs</Badge>
        </div>

        <div className="flex-1" />

        {/* Export */}
        <div className="relative">
          <button
            onClick={() => setExportsOpen((v) => !v)}
            title="Downloadable outputs"
            className="neu-chip inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <AnimatePresence>
            {exportsOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="glass absolute right-0 top-11 z-30 flex w-60 flex-col gap-1 rounded-2xl p-2 neu-soft"
              >
                {[
                  { url: downloadUrl(veloxName), label: "Self-contained .velox DOCX", icon: FileText, acc: true },
                  { url: result?.output_docx ? downloadUrl(result.output_docx) : null, label: "Plain publication DOCX", icon: FileText },
                  { url: result?.audit_html ? downloadUrl(result.audit_html) : null, label: "Audit HTML report", icon: FileText },
                  { url: result?.audit_json ? downloadUrl(result.audit_json) : null, label: "Audit JSON", icon: FileJson },
                ]
                  .filter((x) => x.url)
                  .map((x) => (
                    <a
                      key={x.label}
                      href={x.url}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium",
                        x.acc
                          ? "bg-gradient-to-r from-mint-400 to-aqua-400 text-ink-950 hover:brightness-110"
                          : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      <x.icon className="h-3.5 w-3.5" /> {x.label}
                    </a>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Layout toggle */}
        <button
          onClick={() => setRightMode((m) => (m === "edit" ? "preview" : "edit"))}
          title={rightMode === "edit" ? "Switch to preview" : "Switch to inline editing"}
          className="neu-chip inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-300 hover:text-white"
        >
          {rightMode === "edit" ? <Eye className="h-3.5 w-3.5" /> : <PenLine className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{rightMode === "edit" ? "Preview" : "Edit"}</span>
        </button>

        <button
          onClick={onRunAgain}
          disabled={busy}
          title="Fully reprocess the source document from scratch"
          className="neu-chip inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Reprocess
        </button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={reScan}
          disabled={!edits.length || busy || confirming}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 text-xs font-bold text-ink-950 hover:brightness-110 disabled:opacity-40",
            edits.length > 0 && !busy && !confirming && "shimmer"
          )}
        >
          {busy || confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          Apply & {busy ? "rescan…" : "re-scan"}
        </motion.button>
      </header>

      {(busy || confirming) && <div className="scan-line z-20" />}

      {/* Body */}
      <ResizeSplit
        className="min-h-0 flex-1"
        leftClassName="h-full"
        rightClassName="h-full"
        left={
          <LeftPane
            liveIssues={liveIssues}
            filtered={filtered}
            counts={counts}
            catCounts={catCounts}
            category={category}
            setCategory={setCategory}
            severity={severity}
            setSeverity={setSeverity}
            liveAccuracy={liveAccuracy}
            rulesChecked={stats.rules_checked ?? 24}
            pages={stats.pages_estimate ?? 1}
            fixableCount={fixableCount}
            onAutoFixAll={handleAutoFixAll}
            decisions={decisions}
            onDecide={handleDecide}
            onReanalyze={() => onReanalyze(reviewQueue)}
            onLocate={locate}
            onHover={setHoverIndex}
            busy={busy || confirming}
          />
        }
        right={
          <div className="flex h-full min-w-0 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-ink-950/60 px-4 backdrop-blur">
              <LayoutPanelLeft className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Document
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {elements.length} elements
              </span>
              {Object.keys(overrides).length > 0 && (
                <Badge tone="warning">
                  {Object.keys(overrides).length} local edit{Object.keys(overrides).length === 1 ? "" : "s"}
                </Badge>
              )}
              {hoverIndex !== null && (
                <span className="ml-auto font-mono text-[11px] text-aqua-300">element #{hoverIndex}</span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              {rightMode === "edit" ? (
                <DocEditor
                  elements={elements}
                  issuesByElement={issuesByElement}
                  overrides={overrides}
                  onChange={patch}
                  activeIndex={activeIndex}
                  focusIndex={focusIndex}
                  focusSerial={focusSerial}
                  serial={serialRef.current + (result?.payload?.generated_at || "")}
                  onHover={setHoverIndex}
                />
              ) : (
                <div className="mx-auto w-full max-w-[680px] py-6">
                  <DocPreview elements={elements} overrides={overrides} />
                </div>
              )}
            </div>

            {/* Commit bar */}
            {edits.length > 0 && (
              <div className="shrink-0 border-t border-line bg-ink-950/80 p-3 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`commit message (${edits.length} pending edit${edits.length === 1 ? "" : "s"})`}
                    className="neu-inset min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-slate-600"
                  />
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={applyNow}
                    disabled={busy || confirming}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-5 text-xs font-bold text-ink-950 hover:brightness-110 disabled:opacity-40"
                  >
                    {busy || confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Commit & re-audit
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}

/* ---- left pane ------------------------------------------------------------ */

function LeftPane({
  liveIssues,
  filtered,
  counts,
  catCounts,
  category,
  setCategory,
  severity,
  setSeverity,
  liveAccuracy,
  rulesChecked,
  pages,
  fixableCount,
  onAutoFixAll,
  decisions,
  onDecide,
  onReanalyze,
  onLocate,
  onHover,
  busy,
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? filtered : filtered.slice(0, 10);
  const reviewedCount = Object.keys(decisions).length;

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Metrics */}
      <div className="shrink-0 border-b border-line p-4">
        <div className="glass flex items-center gap-4 rounded-2xl p-3">
          <AccuracyRing value={liveAccuracy} />
<div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Audit</p>
                <span className="pulse-dot inline-flex items-center gap-1 rounded-md bg-aqua-400/10 px-1.5 py-0.5 text-[11px] font-semibold text-aqua-300 ring-1 ring-aqua-400/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-aqua-300" /> live
                </span>
              </div>
              <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 text-rose-300">
                  <AlertCircle className="h-3 w-3" /> <CountUp value={counts.error} />
                </span>
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <AlertTriangle className="h-3 w-3" /> <CountUp value={counts.warning} />
                </span>
                <span className="inline-flex items-center gap-1 text-aqua-300">
                  <Info className="h-3 w-3" /> <CountUp value={counts.info} />
                </span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                <CountUp value={rulesChecked} /> rules checked · <CountUp value={pages} /> pages ·{" "}
                <CountUp value={liveIssues.length} /> findings
              </p>
            </div>
        </div>

        {/* Filter chips */}
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", ...CATEGORY_ORDER].map((c) => {
              const meta = CATEGORY_META[c];
              const count = c === "all" ? liveIssues.length : catCounts[c] || 0;
              const active = category === c;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "relative rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    active ? "text-white" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="cat-pill"
                      className="absolute inset-0 rounded-full bg-white/[0.08] ring-1 ring-line"
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  )}
                  <span className="relative">
                    {c === "all" ? "All" : meta.label}
                    <span className="ml-1 font-mono text-[11px]">{count}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", ...SEVERITY_ORDER].map((s) => {
              const meta = SEVERITY_META[s];
              const active = severity === s;
              return (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active ? "text-slate-100" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sev-pill"
                      className="absolute inset-0 rounded-full"
                      style={{ boxShadow: "inset 0 0 0 1px rgba(148,163,184,0.25)" }}
                      transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    />
                  )}
                  <span className="relative inline-flex items-center gap-1.5">
                    {s !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />}
                    {s === "all" ? "All severities" : meta.label}
                    {s !== "all" && <span className="font-mono text-[11px]">{counts[s] || 0}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Issues */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Findings · {filtered.length}
          </p>
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onAutoFixAll}
              disabled={!fixableCount || busy}
              title="Apply every one-click fix into the document (commit to confirm)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-mint-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-mint-300 ring-1 ring-mint-400/30 hover:bg-mint-400/25 disabled:opacity-40"
            >
              <Wand2 className="h-3 w-3" /> Auto-Fix All{fixableCount ? ` (${fixableCount})` : ""}
            </motion.button>
            {reviewedCount > 0 && (
              <motion.button
                layout
                whileTap={{ scale: 0.97 }}
                onClick={onReanalyze}
                disabled={busy}
                title="Re-run the local pipeline with your review decisions (F101)"
                className="inline-flex items-center gap-1.5 rounded-lg bg-iris-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-iris-300 ring-1 ring-iris-400/30 hover:bg-iris-400/25 disabled:opacity-40"
              >
                <RefreshCw className="h-3 w-3" /> Re-analyze with decisions ({reviewedCount})
              </motion.button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((issue, i) => (
            <IssueCard
              key={`${issue.code}-${issue.source_index}-${i}`}
              index={i}
              issue={issue}
              decided={decisions[issue.source_index] !== undefined}
              onDecide={(action) =>
                isReviewable(issue) && onDecide(issue.source_index, action)
              }
              onLocate={() => onLocate(issue.source_index)}
              onHover={onHover}
            />
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="rounded-2xl py-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-mint-400/10 px-4 py-2 text-sm font-medium text-mint-300 ring-1 ring-mint-400/30">
              <CheckCircle2 className="h-4 w-4" /> All clear — no issues for this filter
            </span>
          </div>
        )}

        {filtered.length > shown.length && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 w-full rounded-xl py-2 text-center text-[11px] font-semibold text-slate-400 hover:text-white"
          >
            {showAll ? "Show fewer" : `Show all ${filtered.length - shown.length} more`}
          </button>
        )}
      </div>
    </div>
  );
}

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = Number(value) || 0;
    prev.current = to;
    if (from === to) return;
    const start = performance.now();
    const dur = 450;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{display}</>;
}

function IssueCard({ issue, index, onLocate, onHover, decided = false, onDecide }) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = FILTER_ICONS[issue.severity] || Info;
  const fix = isFixable(issue) ? true : false;
  const reviewable = isReviewable(issue);
  const page = issue.details?.page;
  const hint = issue.details?.confidence
    ? ` ${(issue.details.confidence * 100).toFixed(0)}% confident`
    : "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.16 } }}
      transition={{ delay: Math.min(index, 12) * 0.03, type: "spring", stiffness: 380, damping: 30 }}
      whileHover={{ y: -2, transition: { type: "spring", stiffness: 500, damping: 28 } }}
      onMouseEnter={() => issue.source_index >= 0 && onHover(issue.source_index)}
      onMouseLeave={() => issue.source_index >= 0 && onHover(null)}
      onClick={() => issue.source_index >= 0 && onLocate(issue.source_index)}
      className={cn(
        "group mb-1.5 cursor-pointer rounded-xl border-l-2 px-3 py-2.5 ring-1 ring-inset transition-colors hover:bg-white/[0.04]",
        meta.mark,
        "ring-white/[0.03]"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meta.text)} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-snug text-slate-200">
            {issue.message}
            {hint}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">{issue.code}</span>
            <span className={cn("rounded px-1 text-[11px] font-medium", meta.chip)}>{meta.label}</span>
            {typeof issue.source_index === "number" && issue.source_index >= 0 && (
              <span className="font-mono text-[11px] text-slate-500">#{issue.source_index}</span>
            )}
            {page && <span className="font-mono text-[11px] text-slate-500">page {page}</span>}
            {reviewable && decided && (
              <span className="rounded bg-iris-400/15 px-1 text-[10px] font-semibold text-iris-300">
                reviewed
              </span>
            )}
          </div>

          {reviewable && !decided && (
            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onDecide("accept"); }}
                title="Accept this classification (records human_review_accepted, F101)"
                className="inline-flex items-center gap-1 rounded-md bg-mint-400/15 px-2 py-0.5 text-[11px] font-semibold text-mint-300 ring-1 ring-mint-400/30 hover:bg-mint-400/25"
              >
                <CheckCircle2 className="h-3 w-3" /> Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDecide("reject_to_paragraph"); }}
                title="Reject this classification — treat the paragraph as body text (F101)"
                className="inline-flex items-center gap-1 rounded-md bg-rose-400/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-400/25"
              >
                <X className="h-3 w-3" /> Reject
              </button>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {fix && (
            <button
              onClick={(e) => { e.stopPropagation(); onLocate(issue.source_index); }}
              title="Jump to element"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.05] text-slate-300 hover:text-aqua-300"
            >
              <LocateFixed className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}