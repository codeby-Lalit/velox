import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "../lib/utils";

const severityStyle = {
  warning: { icon: AlertTriangle, tone: "bg-amber-400/08 ring-amber-400/30 text-amber-300" },
  error: { icon: AlertCircle, tone: "bg-rose-400/[0.07] ring-rose-400/30 text-rose-300" },
  info: { icon: Info, tone: "bg-aqua-400/[0.07] ring-aqua-400/30 text-aqua-300" },
};

export default function IssuesList({ issues }) {
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
  return (
    <div className="space-y-2">
      {issues.map((issue, i) => {
        const style = severityStyle[issue.severity] || severityStyle.info;
        const Icon = style.icon;
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
          </motion.div>
        );
      })}
    </div>
  );
}