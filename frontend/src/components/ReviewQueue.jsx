import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronDown,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

const CHANGE_TYPES = [
  "title",
  "chapter",
  "section",
  "subsection",
  "subsubsection",
  "table_caption",
  "figure_caption",
];

const confidenceColor = (c) =>
  c >= 0.9 ? "bg-mint-400/10 text-mint-300" : c >= 0.7 ? "bg-amber-400/10 text-amber-300" : "bg-rose-400/10 text-rose-300";

export default function ReviewQueue({ items, decisions, onDecision, onReset, onCommit }) {
  const active = decisions.size > 0;
  const allSettled = items.length > 0 && items.every((i) => decisions.has(i.source_index));

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="py-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-mint-400/10 px-4 py-2 text-sm font-medium text-mint-300 ring-1 ring-mint-400/30">
            <Sparkles className="h-4 w-4" />
            Everything was auto-approved — no review needed
          </span>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <ReviewItem
              key={item.source_index}
              item={item}
              decision={decisions.get(item.source_index)}
              onChangeDecision={(action, newType) =>
                onDecision(item.source_index, action, newType)
              }
            />
          ))}
        </AnimatePresence>
      )}

      {active && (
        <div className="sticky bottom-4 mt-4 rounded-2xl border border-line bg-ink-900/90 p-4 backdrop-blur-xl">
          <p className="mb-3 text-xs text-slate-400">
            <span className="font-semibold text-mint-300">{decisions.size} decision{decisions.size === 1 ? "" : "s"}</span> will be applied and the document will be re-analyzed locally.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onReset}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.07]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
            <button
              onClick={onCommit}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 py-2.5 text-sm font-semibold text-ink-950 hover:brightness-110 disabled:opacity-40"
              disabled={!allSettled}
            >
              <Check className="h-4 w-4" />
              {allSettled ? "Re-analyze with decisions" : "Resolve remaining items"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewItem({ item, decision, onChangeDecision }) {
  const [editing, setEditing] = useState(false);
  const settled = Boolean(decision);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      className={cn(
        "glass rounded-2xl p-5 transition-colors",
        settled && "border-mint-400/40"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-72">
          <p className="text-sm leading-relaxed text-white">{item.text || "—"}</p>

          <div className="mt-3 flex items-center gap-3">
            <Badge tone="accent">{item.element_type}</Badge>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ring-1 ring-inset",
                confidenceColor(item.confidence)
              )}
            >
              {(item.confidence * 100).toFixed(0)}%
            </span>
            <span className="font-mono text-[11px] text-slate-500">#{item.source_index}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChangeDecision("accept")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
              decision?.action === "accept"
                ? "bg-mint-400 text-ink-950"
                : "border border-line text-slate-300 hover:border-mint-400/50 hover:text-mint-300"
            )}
          >
            <Check className="h-3.5 w-3.5" /> Accept
          </button>
          <button
            onClick={() => setEditing((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
              decision?.action === "change"
                ? "bg-aqua-400 text-ink-950"
                : "border border-line text-slate-300 hover:border-aqua-400/50 hover:text-aqua-300"
            )}
          >
            <ChevronDown className="h-3.5 w-3.5" /> Change
          </button>
          <button
            onClick={() => onChangeDecision("reject_to_paragraph")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
              decision?.action === "reject_to_paragraph"
                ? "bg-rose-400 text-ink-950"
                : "border border-line text-slate-300 hover:border-rose-400/50 hover:text-rose-300"
            )}
          >
            <X className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">
              {CHANGE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onChangeDecision("change", t);
                    setEditing(false);
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                    decision?.action === "change" && decision?.new_element_type === t
                      ? "bg-aqua-400/20 text-aqua-300 ring-aqua-400/50"
                      : "bg-white/[0.04] text-slate-400 ring-line hover:text-white"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}