import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Loader2,
  FileText,
  FileJson,
  PenLine,
  BookOpen,
  Send,
} from "lucide-react";
import DocPreview from "../components/DocPreview";
import EditPanel from "../components/EditPanel";
import HistoryTimeline from "../components/HistoryTimeline";
import IntegrityBanner from "../components/IntegrityBanner";
import { Badge } from "../components/ui/badge";
import { downloadUrl } from "../lib/utils";
import { autoFix } from "../lib/roles";

/* F110/F111/F112: side-by-side editor with a live preview, inline warnings
   (auto + manual), git-like history, and velox-aware downloads. */
export default function EditorView({
  result,
  onApply,
  onBack,
  onRunAgain,
  busy,
  restoringId,
}) {
  const payload = result.payload || {};
  const [overrides, setOverrides] = useState({});
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const documentView = payload.document_view || [];
  const issues = payload.preflight_issues || [];
  const reviewItems = payload.review?.items || [];
  const history = result.history || { versions: [] };
  const integrity = payload.integrity || {};

  const warningsByIndex = useMemo(() => {
    const map = {};
    for (const it of issues) {
      if (typeof it.source_index !== "number" || it.source_index < 0) continue;
      (map[it.source_index] ||= []).push({
        code: it.code,
        severity: it.severity,
        message: it.message,
        fix: autoFix(it.code, it.details),
        fixLabel: it.code === "hierarchy_jump" ? "Demote to suggested level" : undefined,
      });
    }
    const seen = new Set(map[null]?.map((x) => `${x.code}:${x.message}`) || []);
    for (const r of reviewItems) {
      const key = `low_confidence:${r.source_index}`;
      if (seen.has(key)) continue;
      (map[r.source_index] ||= []).push({
        code: "low_confidence",
        severity: "info",
        message: `Low-confidence classification "${r.element_type}" — review recommended (F101).`,
        fix: null,
      });
    }
    return map;
  }, [issues, reviewItems]);

  const localEdits = Object.keys(overrides)
    .map((idx) => ({
      kind: "paragraph",
      source_index: Number(idx),
      ...(overrides[idx].text !== undefined ? { text: overrides[idx].text } : {}),
      ...(overrides[idx].element_type !== undefined
        ? { element_type: overrides[idx].element_type }
        : {}),
    }))
    .filter((e) => e.text !== undefined || e.element_type !== undefined);

  const lastDiff = history.versions?.[history.versions.length - 1]?.diff || [];
  const base = (payload.source?.path || "").split(/[\\/]/).pop().replace(/\.docx$/i, "") || "document";
  const veloxName = result.velox_docx ? result.velox_docx.split(/[\\/]/).pop() : `${base}_velox.docx`;

  const applyNow = () => {
    setConfirming(true);
    onApply({
      edits: localEdits.filter((e) => e.text !== undefined || e.element_type !== undefined),
      message: message.trim() || `manual edits (${localEdits.length})`,
    }).finally(() => setConfirming(false));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-6xl px-6 py-8"
    >
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="neu-raised-sm inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{base}</p>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <PenLine className="h-3 w-3" /> Editor · reprocess locally on apply
          </p>
        </div>
        <Badge tone={integrity.status === "pass" ? "success" : "error"}>
          {integrity.status === "pass" ? "Verified" : "Failed"}
        </Badge>
        <button
          onClick={onRunAgain}
          disabled={busy}
          className="neu-raised-sm inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-40"
        >
          Reprocess
        </button>
      </div>

      <IntegrityBanner status={integrity.status} source={integrity} output={integrity} />

      {/* Two-pane editor */}
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-3 flex items-center gap-2 px-1">
            <BookOpen className="h-4 w-4 text-aqua-300" />
            <h2 className="text-sm font-semibold text-white">Live preview</h2>
            <span className="text-[11px] text-slate-500">updates as you type</span>
          </div>
          <div className="neu-raised rounded-3xl p-4 lg:sticky lg:top-4">
            <DocPreview elements={documentView} overrides={overrides} />
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-center gap-2 px-1">
            <PenLine className="h-4 w-4 text-mint-300" />
            <h2 className="text-sm font-semibold text-white">Edit</h2>
            <span className="text-[11px] text-slate-500">
              {localEdits.length} pending edit{localEdits.length === 1 ? "" : "s"}
            </span>
          </div>

          {lastDiff.length > 0 && (
            <div className="mb-4 rounded-2xl bg-black/25 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Last round
              </p>
              <div className="space-y-1 font-mono text-[11px]">
                {lastDiff.slice(0, 4).map((d, j) => (
                  <p key={j} className="truncate">
                    <span className="text-slate-500">#{d.source_index}</span>{" "}
                    <span className="text-rose-300/80 line-through">{String(d.before ?? d.before_type)}</span>{" "}
                    → <span className="text-mint-300">{String(d.after ?? d.after_type)}</span>
                  </p>
                ))}
                {lastDiff.length > 4 && (
                  <p className="text-slate-500">…{lastDiff.length - 4} more</p>
                )}
              </div>
            </div>
          )}

          <EditPanel
            elements={documentView}
            overrides={overrides}
            warnings={warningsByIndex}
            onChange={(idx, patch) =>
              setOverrides((prev) => {
                const copy = { ...prev };
                if (Object.keys(patch).length === 0) {
                  delete copy[idx];
                  return copy;
                }
                copy[idx] = { ...(prev[idx] || {}), ...patch };
                const el = documentView.find((e) => e.source_index === Number(idx));
                if (el) {
                  if (copy[idx].text === el.text) delete copy[idx].text;
                  if (copy[idx].element_type === el.element_type) delete copy[idx].element_type;
                  if (!copy[idx].text && !copy[idx].element_type) delete copy[idx];
                }
                return copy;
              })
            }
          />
        </section>
      </div>

      {/* Apply + history + deliverables */}
      <section className="mt-8">
        <div className="neu-raised rounded-3xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Commit message (optional)
              </label>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. corrected section 3 heading + tightened abstract"
                className="neu-inset w-full rounded-2xl px-4 py-3 text-[13px] text-white outline-none placeholder:text-slate-600"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!localEdits.length || busy || confirming}
              onClick={applyNow}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint-400 to-aqua-400 px-6 py-3 text-sm font-bold text-ink-950 hover:brightness-110 disabled:opacity-40"
            >
              {busy || confirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {localEdits.length ? `Apply & Reprocess (${localEdits.length})` : "Nothing to apply"}
            </motion.button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Review the updated document in the preview, then download your_velox.docx
            (self-contained history) or the plain publication DOCX below.
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <HistoryTimeline
          history={history}
          restoringId={restoringId}
          onRestore={(versionId) => {
            const v = history.versions.find((x) => x.id === versionId);
            if (!v) return;
            const restores = (v.edits || []).map((e) => ({
              kind: e.kind || "paragraph",
              source_index: e.source_index,
              ...(e.text !== undefined ? { text: e.text } : {}),
              ...(e.element_type !== undefined ? { element_type: e.element_type } : {}),
            }));
            onApply({
              edits: restores,
              message: `restored ${versionId}${v.message ? ` (${v.message})` : ""}`,
              restore: true,
            });
          }}
        />
        <div className="space-y-4">
          <div className="neu-raised rounded-3xl p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">Deliverables</h3>
            <div className="flex flex-col gap-2">
              <a
                href={downloadUrl(veloxName)}
                className="inline-flex items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 py-3 text-[13px] font-bold text-ink-950 hover:brightness-110"
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> {veloxName}
                </span>
                <span className="rounded-full bg-black/20 px-2 py-0.5 font-mono text-[10px]">
                  .velox
                </span>
              </a>
              {[
                { url: result.output_docx, label: "Plain publication DOCX", icon: FileText },
                { url: result.audit_html, label: "Audit HTML", icon: FileText },
                { url: result.audit_json, label: "Audit JSON", icon: FileJson },
              ]
                .filter((x) => x.url)
                .map((x) => (
                  <a
                    key={x.label}
                    href={downloadUrl(x.url)}
                    className="neu-chip inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    <x.icon className="h-3.5 w-3.5" /> {x.label}
                  </a>
                ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              The <span className="font-semibold text-slate-300">_velox.docx</span> file is a
              standard Word document with the full edit history embedded — open it later via
              “Open .velox” to see and undo edits again.
            </p>
          </div>
          <div className="neu-raised rounded-3xl p-5">
            <h3 className="mb-2 text-sm font-semibold text-white">This round</h3>
            <div className="flex items-center gap-4 text-[12px] text-slate-400">
              <span>
                <Check className="mr-1 inline h-3.5 w-3.5 text-mint-300" />
                {localEdits.length} pending
              </span>
              <span>
                {history.versions?.length || 1} version
                {history.versions?.length === 1 ? "" : "s"}
              </span>
              <span>
                {new Date(payload.generated_at).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}