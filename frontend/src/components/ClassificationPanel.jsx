import { motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";

export default function ClassificationPanel({ classifications }) {
  const [open, setOpen] = useState(new Set());
  const headings = (classifications || []).filter((c) =>
    ["title", "chapter", "section", "subsection", "subsubsection"].includes(c.element_type)
  );

  const toggle = (i) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  if (headings.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-500">No headings classified.</p>;
  }

  return (
    <div className="space-y-2">
      {headings.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          className="glass overflow-hidden rounded-xl"
        >
          <button
            onClick={() => toggle(i)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-slate-500 transition-transform",
                open.has(i) && "rotate-0",
                !open.has(i) && "-rotate-90"
              )}
            />
            <span className="flex-1 min-w-0 truncate text-sm text-white">{c.text || "—"}</span>
            <Badge tone="accent" dot={false}>{c.element_type}</Badge>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              {(c.confidence * 100).toFixed(0)}%
            </span>
          </button>
          {/* reasons */}
          <motion.div
            initial={false}
            animate={{ height: open.has(i) ? "auto" : 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 py-3 pl-11">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                Reasons ({c.reason_codes.length})
              </p>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {c.reason_codes.map((code) => (
                  <li key={code} className="flex items-center gap-2 text-xs text-slate-400">
                    <Check className="h-3 w-3 text-mint-400" />
                    <span className="font-mono">{code}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}