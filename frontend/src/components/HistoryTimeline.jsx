import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitCommitVertical, RotateCcw, GitBranch } from "lucide-react";
import { cn, timeAgo } from "../lib/utils";
import { Badge } from "./ui/badge";

/* F111: git-like version trail. Select any past version and "Restore" to rewind
   the document to that point (its cumulative edit set is resubmitted). */
export default function HistoryTimeline({ history, onRestore, restoringId }) {
  const versions = history?.versions || [];
  const [selected, setSelected] = useState(versions.length ? versions.length - 1 : -1);

  if (!versions.length) {
    return (
      <div className="neu-raised rounded-3xl p-8 text-center text-sm text-slate-400">
        <GitBranch className="mx-auto mb-2 h-5 w-5 text-slate-500" />
        No versions recorded yet — apply your first edit round to create v2.
      </div>
    );
  }
  const sel = versions[selected] || null;

  return (
    <div className="neu-raised rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <GitCommitVertical className="h-4 w-4 text-aqua-300" />
        <h3 className="text-sm font-semibold text-white">Edit history</h3>
        <Badge tone="accent" dot={false}>{versions.length} version{versions.length === 1 ? "" : "s"}</Badge>
      </div>

      <ol className="relative space-y-4 pl-5 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-aqua-400/40 before:to-transparent">
        <AnimatePresence initial={false}>
          {versions.map((v, i) => {
            const head = i === versions.length - 1;
            const isSelected = selected === i;
            return (
              <motion.li
                key={v.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative cursor-pointer"
                onClick={() => setSelected(i)}
              >
                <span
                  className={cn(
                    "absolute -left-[21px] top-1.5 h-4 w-4 rounded-full ring-4 ring-ink-950 transition-colors",
                    head ? "bg-gradient-to-br from-aqua-400 to-iris-400" : "bg-slate-600",
                    isSelected && !head && "bg-amber-400"
                  )}
                />
                <div
                  className={cn(
                    "rounded-2xl p-3.5 transition-colors",
                    isSelected ? "neu-inset-sm" : "neu-chip"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-white">{v.id}</span>
                      <span className="text-[13px] text-slate-200">{v.message || "automatic"}</span>
                      {head && <Badge tone="accent" dot={false}>HEAD</Badge>}
                      {isSelected && !head && <Badge tone="warning">selected</Badge>}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">{timeAgo(v.at)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <Badge tone={v.integrity_status === "pass" ? "success" : "error"}>
                      {v.integrity_status === "pass" ? "verified" : v.integrity_status}
                    </Badge>
                    <span className="text-slate-500">
                      {v.edits?.length || 0} edit{v.edits?.length === 1 ? "" : "s"}
                      {v.stats?.elapsed_ms != null && ` · ${v.stats.elapsed_ms} ms`}
                    </span>
                  </div>

                  {v.diff && v.diff.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-xl bg-black/25 p-2.5">
                      {v.diff.map((d, j) => (
                        <div key={j} className="flex items-baseline gap-2 font-mono text-[10.5px] leading-relaxed">
                          <span className="shrink-0 text-slate-500">#{d.source_index}</span>
                          {d.before !== undefined && d.before !== null && (
                            <span className="truncate text-rose-300/80 line-through">{String(d.before)}</span>
                          )}
                          {d.after !== undefined && d.after !== null && (
                            <span className="truncate text-mint-300">{String(d.after)}</span>
                          )}
                          {d.before_type !== d.after_type && (
                            <span className="shrink-0 text-aqua-300">
                              {d.before_type} → {d.after_type}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          {sel
            ? `${sel.id} — ${sel.edits?.length || 0} edits · ${sel.integrity_status}`
            : "Select a version"}
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!sel || Boolean(restoringId)}
          onClick={() => onRestore(sel.id)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 py-2 text-xs font-bold text-ink-950 hover:brightness-110 disabled:opacity-40"
        >
          <RotateCcw className={cn("h-3.5 w-3.5", restoringId && "animate-spin")} />
          {restoringId
            ? "Restoring…"
            : selected === versions.length - 1
              ? "Re-apply HEAD"
              : `Restore to ${sel.id}`}
        </motion.button>
      </div>
    </div>
  );
}