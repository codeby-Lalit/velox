import { motion } from "framer-motion";
import { FolderOpen, ArrowLeft, PenLine, History, Loader2 } from "lucide-react";
import HistoryTimeline from "../components/HistoryTimeline";
import { Badge } from "../components/ui/badge";
import { timeAgo } from "../lib/utils";

/* F112: a re-opened *_velox.docx — full history restored. Pick any version and
   restore (edits are re-applied to the embedded original, so it is exact), or
   resume editing right where the file left off. */
export default function OpenedView({
  openResult,
  onBack,
  onRestore,
  onResume,
  busy,
  restoringId,
}) {
  const history = openResult.history || { versions: [] };
  const manifest = openResult.manifest || {};
  const versions = history.versions || [];
  const filename = openResult.filename || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-3xl px-6 py-8"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="neu-raised-sm inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 hover:text-ink-900"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink-900">{filename}</p>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <FolderOpen className="h-3 w-3" /> Circuit Networks .velox document
          </p>
        </div>
        <Badge tone="accent">{manifest.engine || "velox"}</Badge>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onResume}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 text-xs font-bold text-ink-950 hover:brightness-110 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenLine className="h-3.5 w-3.5" />}
          Resume editing
        </motion.button>
      </div>

      <div className="neu-raised rounded-3xl p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-slate-400">
          <span>
            Created <span className="font-mono text-slate-300">{timeAgo(manifest.created_at)}</span>
          </span>
          <span>
            <span className="font-mono text-slate-300">{versions.length}</span> version
            {versions.length === 1 ? "" : "s"}
          </span>
          {manifest.source?.filename && (
            <span>
              Original · <span className="text-slate-300">{manifest.source.filename}</span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-6">
        <HistoryTimeline
          history={history}
          restoringId={restoringId}
          onRestore={(versionId) => {
            const v = versions.find((x) => x.id === versionId);
            if (!v) return;
            onRestore({
              edits: (v.edits || []).map((e) => ({
                kind: e.kind || "paragraph",
                source_index: e.source_index,
                ...(e.text !== undefined ? { text: e.text } : {}),
                ...(e.element_type !== undefined ? { element_type: e.element_type } : {}),
              })),
              message: `restored ${versionId}${v.message ? ` (${v.message})` : ""}`,
            });
          }}
        />
      </div>

      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
        <History className="h-3.5 w-3.5" />
        Restore re-runs the embedded original with that version's edits — history keeps
        growing and nothing is erased. Restores must be applied while this file is present.
      </p>
    </motion.div>
  );
}