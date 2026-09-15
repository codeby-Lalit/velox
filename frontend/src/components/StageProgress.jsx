import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

export const STAGES = [
  { id: "parse", label: "Parsing document", desc: "Extracting runs, styles & tables" },
  { id: "classify", label: "Structure analysis", desc: "Inferring headings, captions & hierarchy" },
  { id: "preflight", label: "Preflight validation", desc: "Checking hierarchy, numbering & captions" },
  { id: "format", label: "Applying publisher profile", desc: "Typography, spacing & page layout" },
  { id: "integrity", label: "Integrity verification", desc: "Comparing content & fingerprints" },
  { id: "report", label: "Generating audit report", desc: "Writing JSON & HTML audit trail" },
];

export default function StageProgress({ current, value }) {
  const done = STAGES.findIndex((s) => s.id === current);
  return (
    <div className="mx-auto w-full max-w-md">
      {/* pipeline progress rail */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-aqua-400 to-iris-400"
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 20 }}
        />
      </div>
      <ol className="mt-7 space-y-2">
        {STAGES.map((s, i) => {
          const state = i < done ? "done" : i === done ? "active" : "todo";
          return (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1",
                  state === "done" && "bg-mint-400/15 ring-mint-400/30 text-mint-300",
                  state === "active" && "bg-aqua-400/15 ring-aqua-400/50 text-aqua-300",
                  state === "todo" && "bg-white/[0.04] ring-line text-slate-500"
                )}
              >
                {state === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="font-mono text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[13px] font-medium tracking-tight",
                    state === "todo" ? "text-slate-500" : "text-white"
                  )}
                >
                  {s.label}
                </span>
                <span className="hidden text-[11px] text-slate-500 sm:block">{s.desc}</span>
              </span>
              {state === "active" && (
                <motion.span
                  className="h-2 w-2 rounded-full bg-aqua-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}