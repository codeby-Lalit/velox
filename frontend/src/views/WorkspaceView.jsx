import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Info,
  LocateFixed,
  Wand2,
  RefreshCw,
  Download,
  FileText,
  FileJson,
  Send,
  Loader2,
  Gauge,
  CheckCircle2,
  LayoutPanelLeft,
  GitCompareArrows,
  PencilLine,
  History,
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
  planFullFix,
  computeLiveStats,
} from "../lib/issues";
import { ROLE_TYPES } from "../lib/roles";
import { Badge } from "../components/ui/badge";
import AccuracyRing from "../components/AccuracyRing";
import ResizeSplit from "../components/ResizeSplit";
import DocPreview from "../components/DocPreview";
import ComparePanel from "../components/ComparePanel";
import HistoryTimeline from "../components/HistoryTimeline";

const FILTER_ICONS = { error: AlertCircle, warning: AlertTriangle, info: Info };

export default function WorkspaceView({
  result,
  onApply,
  onReanalyze = () => {},
  onBack,
  onRunAgain,
  busy,
  restoringId,
  onReviewPrompt = () => {},
}) {
  const payload = result?.payload || {};
  const stats = payload.processing_stats || {};
  const [overrides, setOverrides] = useState({});
  const [decisions, setDecisions] = useState({});
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [focusIndex, setFocusIndex] = useState(null);
  const [focusSerial, setFocusSerial] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [exportsOpen, setExportsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resolution, setResolution] = useState("open"); // "open" | "fixed"
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  const history = result?.history || { versions: [] };

  const notify = useCallback((data) => {
    setNotice(data);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

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

  /* Elements already fixed — via Accept (decision) or a Manual role/text edit
     (override). These power the "Fixed" toggle + count in the audit card.
     Declared BEFORE `filtered` because it reads fixedIssues — a const in TDZ
     would throw and unmount the whole app (white page after analysis). */
  const fixedByIndex = useMemo(() => {
    const map = {};
    for (const issue of issues) {
      if (typeof issue.source_index !== "number" || issue.source_index < 0) continue;
      const el = byIndex.get(issue.source_index);
      if (!el) continue;
      if (issueIsResolved(issue, el, overrides[issue.source_index], decisions)) {
        (map[issue.source_index] ||= []).push(issue);
      }
    }
    return map;
  }, [issues, overrides, decisions, byIndex]);

  const fixedIssues = useMemo(
    () =>
      Object.values(fixedByIndex)
        .flat()
        .filter((i) => category === "all" || i.category === category),
    [fixedByIndex, category]
  );
  const fixedCount = Object.keys(fixedByIndex).length;

  const filtered = useMemo(() => {
    if (resolution === "fixed") return fixedIssues;
    return liveIssues.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (severity === "all" || i.severity === severity)
    );
  }, [liveIssues, fixedIssues, category, severity, resolution]);

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
    () =>
      liveIssues.filter((i) => isFixable(i, byIndex.get(i.source_index))).length,
    [liveIssues, byIndex]
  );

  const liveAccuracy = useMemo(() => {
    let score = 100;
    for (const i of liveIssues) {
      score -= i.severity === "error" ? 5 : i.severity === "warning" ? 2 : 0.25;
    }
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [liveIssues]);

  const edits = useMemo(() => buildEdits(overrides, elements), [overrides, elements]);
  const liveStats = useMemo(
    () => computeLiveStats(elements, overrides),
    [elements, overrides]
  );
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
    if (busy || confirming) return;
    // Auto-fix everything EXCEPT low-confidence — those need a human decision
    // on the finding card (Accept / Manual). Fixes are committed immediately so
    // the document updates live and nothing is left staged. Staged manual
    // overrides (right-panel role picker / inline edits) ride along in the same
    // commit so they are never silently dropped by an "apply all".
    const fixIssues = liveIssues.filter((i) => i.code !== "low_confidence");
    const lowCount = liveIssues.length - fixIssues.length;
    const setTitle = fixIssues.some((i) => i.code === "metadata_missing") ? base : undefined;
    const { overrides: fixOverrides } = planFullFix(fixIssues, byIndex);

    const editOverrides = { ...overrides, ...fixOverrides };
    const edits = buildEdits(editOverrides, elements);

    if (!edits.length) {
      if (lowCount) {
        onReviewPrompt({ fixed: 0, low: lowCount });
        return;
      }
      notify({ text: "No one-click fixes to apply" });
      return;
    }

    setOverrides(editOverrides);
    setResolution("open");
    notify({
      text: `${edits.length} fix${edits.length === 1 ? "" : "es"} applied & committed — document updated live`,
      low: lowCount,
      message: lowCount
        ? `${lowCount} low-confidence finding${lowCount === 1 ? "" : "s"} left for manual review`
        : null,
    });
    setConfirming(true);
    onApply({
      edits,
      setTitle,
      message: `auto-fix all (${edits.length}): apply one-click fixes`,
    })
      .then(() => {
        if (lowCount) onReviewPrompt({ fixed: edits.length, low: lowCount });
        setOverrides({});
        setMessage("");
      })
      .catch(() => {})
      .finally(() => setConfirming(false));
  };

  const handleDecide = (idx, action) => {
    setDecisions((prev) => ({
      ...prev,
      [idx]: { source_index: idx, action, new_element_type: null },
    }));
  };

  const reviewQueue = useMemo(() => Object.values(decisions), [decisions]);

  const locate = useCallback((idx) => {
    setFocusIndex(idx);
    setFocusSerial((s) => s + 1);
  }, []);

  const patch = useCallback(
    (idx, patch) => {
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
    },
    [byIndex]
  );

  /* Manual fix from the FINDING card (right panel): pick the role right there.
     Same role as classified → record a human accept; otherwise patch the role
     (live amber ring in the document) ready for the next re-scan. */
  const handleManualFix = useCallback(
    (idx, elementType) => {
      const el = byIndex.get(idx);
      if (!el) {
        locate(idx);
        return;
      }
      if (elementType === el.element_type) {
        handleDecide(idx, "accept");
      } else {
        patch(idx, { element_type: elementType });
      }
      locate(idx);
    },
    [byIndex, patch, handleDecide, locate]
  );

  const handleRestore = useCallback(
    (versionId) => {
      const v = history.versions.find((x) => x.id === versionId);
      if (!v) return;
      setHistoryOpen(false);
      const restored = (v.edits || []).map((e) => ({
        kind: e.kind || "paragraph",
        source_index: e.source_index,
        ...(e.text !== undefined ? { text: e.text } : {}),
        ...(e.element_type !== undefined ? { element_type: e.element_type } : {}),
      }));
      onApply({ edits: restored, message: `restored ${versionId} · ${v.message || "automatic"}` });
      setOverrides({});
    },
    [history.versions, onApply]
  );

  const veloxName = result?.velox_docx
    ? result.velox_docx.split(/[\\/]/).pop()
    : `${base}_velox.docx`;

  /* ---- render -------------------------------------------------------------- */
  return (
    <div className="circuit-bg relative flex h-screen w-full flex-col">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      {/* Top bar */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white/70 px-4 backdrop-blur-xl">
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          onClick={onBack}
          className="neu-chip inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:text-ink-900"
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
          <p className="truncate text-[14px] font-semibold text-ink-900 leading-snug">{base}</p>
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
            className="neu-chip inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-400 hover:text-ink-900"
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
                          : "text-slate-400 hover:bg-slate-800/25 hover:text-ink-900"
                      )}
                    >
                      <x.icon className="h-3.5 w-3.5" /> {x.label}
                    </a>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setCompareOpen(true)}
          title="Compare your original document with the formatted result — proves content preserved (R3/R4)"
          className="neu-chip inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-400 hover:text-ink-900"
        >
          <GitCompareArrows className="h-3.5 w-3.5" /> Compare
        </button>

        <button
          onClick={() => setHistoryOpen(true)}
          title="Git-like version history — pick any round and restore it"
          className="neu-chip inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-400 hover:text-ink-900"
        >
          <History className="h-3.5 w-3.5" /> History
          <span className="rounded-md bg-slate-800/15 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            {(history.versions || []).length}
          </span>
        </button>

        <button
          onClick={onRunAgain}
          disabled={busy}
          title="Fully reprocess the source document from scratch"
          className="neu-chip inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-slate-400 hover:text-ink-900 disabled:opacity-40"
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
          <div className="flex h-full min-w-0 flex-col">
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line bg-white/60 px-4 backdrop-blur">
              <LayoutPanelLeft className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Document
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {elements.length} elements
              </span>
              {hoverIndex !== null && (
                <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-aqua-300">
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-aqua-400" /> element #{hoverIndex}
                </span>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <DocPreview
                elements={elements}
                issuesByElement={issuesByElement}
                overrides={overrides}
                onChange={patch}
                focusIndex={focusIndex}
                focusSerial={focusSerial}
                onHover={setHoverIndex}
              />
            </div>

            {/* Commit bar */}
            {edits.length > 0 && (
              <div className="shrink-0 border-t border-line bg-white/70 p-3 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`commit message (${edits.length} pending edit${edits.length === 1 ? "" : "s"})`}
                    className="neu-inset min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-xs text-ink-900 outline-none placeholder:text-slate-500"
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
        right={
          <LeftPane
            liveIssues={liveIssues}
            filtered={filtered}
            counts={counts}
            catCounts={catCounts}
            category={category}
            setCategory={setCategory}
            severity={severity}
            setSeverity={setSeverity}
            resolution={resolution}
            setResolution={setResolution}
            fixedCount={fixedCount}
            roleFor={byIndex}
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
            onManualFix={handleManualFix}
            hoverIndex={hoverIndex}
            busy={busy || confirming}
          />
        }
      />

      {/* Confidence / manual-edit notification */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="glass pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl px-4 py-3 neu-soft"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  notice.low ? "bg-amber-400" : "bg-mint-400"
                )}
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-900">Auto-Fix All</p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                  {notice.message || notice.text}
                </p>
                {notice.low > 0 && notice.message && (
                  <p className="mt-0.5 text-[11px] text-slate-400">{notice.text}</p>
                )}
              </div>
              {notice.reviewIndex !== undefined && notice.reviewIndex !== null && (
                <button
                  onClick={() => locate(notice.reviewIndex)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-iris-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-iris-300 ring-1 ring-iris-400/30 hover:bg-iris-400/25"
                >
                  <LocateFixed className="h-3 w-3" /> Review
                </button>
              )}
              <button
                onClick={() => setNotice(null)}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/25 hover:text-ink-900"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Before/after content-preservation comparison */}
      <AnimatePresence>
        {compareOpen && (
          <ComparePanel
            payload={payload}
            history={history}
            liveStats={liveStats}
            liveIssues={liveIssues}
            onClose={() => setCompareOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Git-like version history */}
      <AnimatePresence>
        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryOpen(false)}
              className="absolute inset-0 bg-ink-700/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-label="Document history"
              className="relative flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl glass-strong shadow-2xl"
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-line bg-white/70 px-5 py-4 backdrop-blur">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-aqua-400/12 text-aqua-300 ring-1 ring-aqua-400/25">
                  <History className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">History & restore</p>
                  <p className="truncate text-[11px] text-slate-400">
                    Git-like rounds — each commit records a verified, diffable state
                  </p>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close history"
                  className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/25 hover:text-ink-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-transparent p-5">
                <HistoryTimeline
                  history={history}
                  restoringId={restoringId}
                  onRestore={handleRestore}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
  resolution,
  setResolution,
  fixedCount,
  roleFor,
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
  onManualFix,
  hoverIndex = null,
  busy,
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? filtered : filtered.slice(0, 10);
  const reviewedCount = Object.keys(decisions).length;

  const showFixed = resolution === "fixed";

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
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <button
                  onClick={() => setResolution((r) => (r === "fixed" ? "open" : "fixed"))}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors",
                    resolution === "fixed"
                      ? "bg-mint-400/20 text-mint-300 ring-1 ring-mint-400/40"
                      : "text-mint-300/90 hover:bg-mint-400/10 hover:text-mint-300"
                  )}
                  title={`${fixedCount} element${fixedCount === 1 ? "" : "s"} fixed (accept / manual role edit) — click to list them`}
                >
                  <CheckCircle2 className="h-3 w-3" /> Fixed <CountUp value={fixedCount} />
                </button>
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
          {/* Findings / Fixed — explicit list switcher (fixed = accepted or
              reclassified elements, virtualized from resolve + override). */}
          <div className="flex items-center gap-1 rounded-full bg-slate-800/10 p-0.5 ring-1 ring-line">
            <button
              onClick={() => setResolution("open")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                !showFixed
                  ? "bg-white/85 text-ink-900 shadow-sm"
                  : "text-slate-400 hover:text-ink-900"
              )}
            >
              Findings · <CountUp value={liveIssues.length} />
            </button>
            <button
              onClick={() => setResolution("fixed")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
                showFixed
                  ? "bg-white/85 text-ink-900 shadow-sm"
                  : "text-slate-400 hover:text-ink-900"
              )}
            >
              <CheckCircle2 className="h-3 w-3 text-mint-400" /> Fixed ·{" "}
              <CountUp value={fixedCount} />
            </button>
          </div>

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
                    active ? "text-ink-900" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="cat-pill"
                      className="absolute inset-0 rounded-full bg-slate-800/10 ring-1 ring-line"
                      transition={{ type: "spring", stiffness: 500, damping: 45 }}
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
                      transition={{ type: "spring", stiffness: 500, damping: 45 }}
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
            {resolution === "fixed" ? "Fixed elements" : "Findings"} · {filtered.length}
          </p>
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onAutoFixAll}
              disabled={busy}
              title={
                fixableCount
                  ? "Apply every one-click fix into the document (commit to confirm)"
                  : "No one-click fixes — formatting is applied when you commit/re-scan"
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-mint-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-mint-300 ring-1 ring-mint-400/30 hover:bg-mint-400/25 disabled:opacity-40"
            >
              <Wand2 className="h-3 w-3" /> Auto-Fix All
              {fixableCount ? ` (${fixableCount})` : ""}
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
              el={roleFor.get(issue.source_index)}
              role={roleFor.get(issue.source_index)?.element_type}
              fixed={resolution === "fixed"}
              decided={decisions[issue.source_index] !== undefined}
              onDecide={(action) =>
                isReviewable(issue) && onDecide(issue.source_index, action)
              }
              onLocate={() => onLocate(issue.source_index)}
              onHover={onHover}
              onManualFix={(type) => onManualFix(issue.source_index, type)}
              marked={hoverIndex !== null && issue.source_index === hoverIndex}
            />
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="rounded-2xl py-10 text-center">
            {resolution === "fixed" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm font-medium text-slate-400 ring-1 ring-line">
                <Info className="h-4 w-4" /> Nothing fixed yet — Accept or set a role to mark an element fixed
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-mint-400/10 px-4 py-2 text-sm font-medium text-mint-300 ring-1 ring-mint-400/30">
                <CheckCircle2 className="h-4 w-4" /> All clear — no issues for this filter
              </span>
            )}
          </div>
        )}

        {filtered.length > shown.length && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-1 w-full rounded-xl py-2 text-center text-[11px] font-semibold text-slate-400 hover:text-ink-900"
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

function IssueCard({
  issue,
  index,
  onLocate,
  onHover,
  decided = false,
  fixed = false,
  role,
  el,
  onDecide,
  onManualFix,
  marked = false,
}) {
  const meta = SEVERITY_META[issue.severity];
  const Icon = FILTER_ICONS[issue.severity] || Info;
  const [picking, setPicking] = useState(false);
  const fix = isFixable(issue, el);
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
      transition={{ delay: Math.min(index, 12) * 0.03, type: "spring", stiffness: 380, damping: 40 }}
      whileHover={{ y: -2, transition: { type: "spring", stiffness: 500, damping: 45 } }}
      onMouseEnter={() => issue.source_index >= 0 && onHover(issue.source_index)}
      onMouseLeave={() => issue.source_index >= 0 && onHover(null)}
      onClick={() => issue.source_index >= 0 && onLocate(issue.source_index)}
      className={cn(
        "group mb-1.5 cursor-pointer rounded-xl border-l-2 px-3 py-2.5 ring-1 ring-inset transition-all",
        fixed ? "border-l-mint-400/80 bg-mint-400/[0.06]" : meta.mark,
        marked
          ? "ring-2 ring-inset ring-aqua-400/80 bg-aqua-400/[0.07] shadow-[0_0_0_4px_rgba(0,183,209,0.10)]"
          : "ring-slate-800/10 hover:bg-white/60"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", fixed ? "text-mint-400" : meta.text)} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[12px] leading-snug",
              fixed ? "line-through decoration-mint-400/50 text-slate-400" : "text-slate-200"
            )}
          >
            {issue.message}
            {hint}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">{issue.code}</span>
            <span
              className={cn(
                "rounded px-1 text-[11px] font-medium",
                fixed ? "bg-mint-400/15 text-mint-300" : meta.chip
              )}
            >
              {fixed ? "fixed" : meta.label}
            </span>
            {typeof issue.source_index === "number" && issue.source_index >= 0 && (
              <span className="font-mono text-[11px] text-slate-500">#{issue.source_index}</span>
            )}
            {page && <span className="font-mono text-[11px] text-slate-500">page {page}</span>}
            {reviewable && decided && !fixed && (
              <span className="rounded bg-iris-400/15 px-1 text-[10px] font-semibold text-iris-300">
                accepted
              </span>
            )}
          </div>

          {reviewable && !decided && !fixed && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onDecide("accept"); }}
                title="Accept this classification — records human_review_accepted, F101"
                className="inline-flex items-center gap-1 rounded-md bg-mint-400/15 px-2 py-0.5 text-[11px] font-semibold text-mint-300 ring-1 ring-mint-400/30 hover:bg-mint-400/25"
              >
                <CheckCircle2 className="h-3 w-3" /> Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPicking((v) => !v); }}
                title="Low-confidence findings can only be fixed by a human — choose the correct role here"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 transition-colors",
                  picking
                    ? "bg-iris-400/20 text-iris-300 ring-iris-400/40"
                    : "bg-aqua-400/15 text-aqua-300 ring-aqua-400/30 hover:bg-aqua-400/25"
                )}
              >
                <PencilLine className="h-3 w-3" /> {picking ? "Cancel" : "Set role"}
              </button>
            </div>
          )}

          {picking && !fixed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl border border-line bg-white/70 p-1.5">
                {ROLE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={(e) => {
                      e.stopPropagation();
                      onManualFix(t);
                      setPicking(false);
                    }}
                    className={cn(
                      "rounded-lg px-2 py-1 text-left text-[11px] font-semibold transition-colors",
                      t === role
                        ? "bg-iris-400/20 text-iris-300 ring-1 ring-iris-400/40"
                        : "text-slate-400 hover:bg-slate-800/10 hover:text-slate-300"
                    )}
                  >
                    {t.replace("_", " ")}
                    {t === role ? " ✓" : ""}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                Same role = record as accepted · different role = reclassify this element
              </p>
            </motion.div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {fix && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setPicking((v) => !v); }}
                title="Fix this element from the right panel — pick the right role"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/10 text-slate-400 hover:text-aqua-300"
              >
                <Wand2 className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onLocate(issue.source_index); }}
                title="Jump to element"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/10 text-slate-400 hover:text-aqua-300"
              >
                <LocateFixed className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}