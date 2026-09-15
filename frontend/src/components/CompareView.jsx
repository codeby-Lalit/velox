import { motion } from "framer-motion";
import { ArrowRight, FileOutput } from "lucide-react";
import { cn } from "../lib/utils";

const KIND_STYLE = {
  title: "text-iris-300",
  chapter: "text-iris-300",
  section: "text-aqua-300",
  subsection: "text-aqua-300",
  subsubsection: "text-iris-300",
  table: "text-amber-300",
  table_caption: "text-amber-300",
  figure_caption: "text-mint-300",
};

export default function CompareView({ rows }) {
  if (!rows || rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        No structural elements to compare in this document.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="mb-3 flex items-center justify-between rounded-xl bg-ink-950/50 px-4 py-2.5 text-[11px] uppercase tracking-wider text-slate-500">
        <span>Detected on source → format target (from profile)</span>
        <span className="normal-case tracking-normal text-slate-600">
          {rows.length} element{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {rows.map((row, i) => {
        const font = row.target_font || {};
        return (
          <motion.div
            key={`${row.source_index}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className="grid items-start gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-line sm:grid-cols-[1fr_auto_1fr]"
          >
            {/* Detected (source) side */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase",
                    KIND_STYLE[row.element_type] || "text-slate-400"
                  )}
                >
                  {row.element_type}
                </span>
                {row.source_style && (
                  <span className="font-mono text-[10px] text-slate-500">
                    src: {row.source_style}
                  </span>
                )}
                {row.confidence != null && (
                  <span className="font-mono text-[10px] text-slate-600">
                    {(row.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="mt-1.5 truncate text-sm text-slate-300">
                {row.text || <span className="italic text-slate-600">—</span>}
              </p>
            </div>

            <div className="hidden sm:block">
              <ArrowRight className="h-4 w-4 text-slate-600" />
            </div>

            {/* Formatted (target) side */}
            <div className="min-w-0 rounded-lg bg-aqua-400/[0.05] px-3 py-2 ring-1 ring-aqua-400/15">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-aqua-400/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-aqua-300">
                  {row.target_style || "Body"}
                </span>
                {font.name && (
                  <span className="font-mono text-[10px] text-slate-400">
                    {font.name} · {font.size}pt
                    {font.bold ? " · bold" : ""}
                    {font.italic ? " · italic" : ""}
                  </span>
                )}
              </div>
              <p className="mt-1.5 truncate text-sm text-slate-200">
                {row.text || <span className="italic text-slate-600">—</span>}
              </p>
            </div>
          </motion.div>
        );
      })}
      <p className="pt-2 text-[11px] text-slate-600">
        <FileOutput className="mr-1 inline h-3 w-3" />
        Apply profile formatting to a copy — source content is never modified (R3/R8).
      </p>
    </div>
  );
}