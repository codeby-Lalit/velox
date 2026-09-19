import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "../lib/utils";

export default function IntegrityBanner({ status, source, output }) {
  const pass = status === "pass";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-wrap items-center gap-5 rounded-2xl px-6 py-5 ring-1",
        pass ? "bg-mint-400/[0.06] ring-mint-400/30" : "bg-rose-400/[0.06] ring-rose-400/30"
      )}
    >
      <motion.div
        initial={{ scale: 0, rotate: -60 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 33, delay: 0.15 }}
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full",
          pass ? "bg-mint-400/15" : "bg-rose-400/15"
        )}
      >
        {pass ? (
          <ShieldCheck className="h-6 w-6 text-mint-300" />
        ) : (
          <ShieldAlert className="h-6 w-6 text-rose-300" />
        )}
      </motion.div>

      <div>
        <p className={cn("text-[15px] font-semibold", pass ? "text-mint-300" : "text-rose-300")}>
          Integrity {pass ? "Passed" : "Failed"}
        </p>
        <p className="text-xs text-slate-400">
          Paragraphs {source?.source_paragraphs ?? 0} → {output?.output_paragraphs ?? 0} · Words{" "}
          {source?.source_words ?? 0} → {output?.output_words ?? 0}
        </p>
      </div>

      {pass && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35 }}
          className="ml-auto text-xs font-medium text-mint-300/80"
        >
          Text preserved exactly ✓
        </motion.span>
      )}
    </motion.div>
  );
}