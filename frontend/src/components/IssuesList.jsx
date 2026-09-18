import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, AlertCircle, Info, LocateFixed, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

const PAGE_SIZE = 10;

const severityStyle = {
  warning: { icon: AlertTriangle, tone: "bg-amber-400/08 ring-amber-400/30 text-amber-300" },
  error: { icon: AlertCircle, tone: "bg-rose-400/[0.07] ring-rose-400/30 text-rose-300" },
  info: { icon: Info, tone: "bg-aqua-400/[0.07] ring-aqua-400/30 text-aqua-300" },
};

export default function IssuesList({ issues, onLocate }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (!issues || issues.length === 0) {
    return (
      <div className="py-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-mint-400/10 px-4 py-2 text-sm font-medium text-mint-300 ring-1 ring-mint-400/30">
          <span className="h-2 w-2 rounded-full bg-mint-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          All clear — no preflight issues
        </span>
      </div>
    );
  }

  const shown = issues.slice(0, visible);

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {shown.map((issue, i) => {
          const style = severityStyle[issue.severity] || severityStyle.info;
          const Icon = style.icon;
          const hasLocation = typeof issue.source_index === "number" && issue.source_index >= 0;
          return (
            <motion.div
              key={`${issue.code}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                "flex items-start gap-4 rounded-xl px-4 py-3 ring-1 ring-inset",
                style.tone
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-white">{issue.message}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">{issue.code}</p>
              </div>
              {hasLocation && onLocate && (
                <button
                  onClick={() => onLocate(issue.source_index)}
                  title={`Jump to element ${issue.source_index} (F105)`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-white/[0.06] hover:text-aqua-300"
                >
                  <LocateFixed className="h-3 w-3" />
                  <span className="hidden sm:inline">Locate</span>
                  <span className="font-mono text-slate-500">#{issue.source_index}</span>
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {issues.length > visible && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-slate-400 hover:bg-white/[0.04] hover:text-white"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Show {Math.min(PAGE_SIZE, issues.length - visible)} more ({issues.length - visible} remaining)
        </motion.button>
      )}
      <p className="px-1 pt-1 text-[11px] text-slate-500">
        Showing {Math.min(visible, issues.length)} of {issues.length} findings
      </p>
    </div>
  );
}