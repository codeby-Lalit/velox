import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, AlertCircle, Info, Wand2, ChevronDown, Check } from "lucide-react";
import { cn } from "../lib/utils";
import { ROLE_TYPES } from "../lib/roles";
import { Badge } from "./ui/badge";

const PAGE_SIZE = 25;

/* F110: per-element manual editing (text + role) with inline warnings.
   Each warning row offers a one-click auto-fix when the backend rule has one,
   plus full manual control via the textarea and role select. */
export default function EditPanel({ elements, overrides, warnings, onChange }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  const items = elements || [];
  if (!items.length) {
    return (
      <div className="rounded-3xl p-12 text-center text-sm text-slate-400 neu-raised">
        No editable content available.
      </div>
    );
  }

  const shown = items.slice(0, visible);
  const pageWarnings = (sourceIndex) =>
    (warnings[sourceIndex] || []).filter((w) => w.severity !== "info").slice(0, 3);

  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {shown.map((el) => (
          <EditRow
            key={el.kind + "-" + el.source_index}
            el={el}
            override={overrides[el.source_index]}
            inlineWarnings={pageWarnings(el.source_index)}
            onChange={(patch) => onChange(el.source_index, patch)}
          />
        ))}
      </AnimatePresence>

      {items.length > visible && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="neu-raised-sm w-full rounded-2xl py-3 text-xs font-semibold text-slate-300 hover:text-white"
        >
          Show more ({Math.max(0, items.length - visible)} remaining)
        </motion.button>
      )}

      <p className="px-1 text-[11px] text-slate-500">
        Showing {Math.min(visible, items.length)} of {items.length} elements · edits apply
        cumulatively on “Apply & Reprocess”
      </p>
    </div>
  );
}

function EditRow({ el, override, inlineWarnings, onChange }) {
  const [open, setOpen] = useState(Boolean(override) || inlineWarnings.length > 0);
  const edited = Boolean(override);
  const text = override?.text !== undefined ? override.text : el.text;
  const role = override?.element_type || el.element_type;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 36 }}
      className={cn("neu-raised rounded-3xl p-4", edited && "ring-1 ring-amber-400/40")}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-slate-500">#{el.source_index}</span>
            <Badge tone={edited ? "warning" : "neutral"}>{role}</Badge>
            {edited && <Badge tone="success">edited</Badge>}
          </div>
          <p
            className={cn(
              "text-[13px] leading-relaxed",
              edited ? "text-amber-200/90" : "text-slate-200 line-clamp-3"
            )}
          >
            {text || "—"}
          </p>
        </div>
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              {inlineWarnings.length > 0 && (
                <div className="space-y-2">
                  {inlineWarnings.map((w, i) => (
                    <WarningRow
                      key={`${w.code}-${i}`}
                      w={w}
                      onAutoFix={() => w.fix && onChange(w.fix)}
                    />
                  ))}
                </div>
              )}

              <textarea
                value={text}
                onChange={(e) => onChange({ text: e.target.value })}
                rows={Math.min(5, Math.max(2, Math.ceil((text || "").length / 90)))}
                className="neu-inset w-full resize-y rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed text-white outline-none placeholder:text-slate-600"
                placeholder="Edit the paragraph text…"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] text-slate-500">Role</span>
                {ROLE_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => onChange({ element_type: t })}
                    className={cn(
                      "rounded-xl px-2.5 py-1 text-[11px] font-medium transition-colors",
                      role === t
                        ? "neu-inset-sm bg-aqua-400/15 text-aqua-300"
                        : "neu-chip text-slate-400 hover:text-white"
                    )}
                  >
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
              {override?.text !== undefined && override.text !== el.text && (
                <p className="rounded-xl px-3 py-1.5 font-mono text-[11px] text-slate-500 line-through">
                  {el.text}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const SEVERITY = {
  warning: { icon: AlertTriangle, tone: "text-amber-300" },
  error: { icon: AlertCircle, tone: "text-rose-300" },
  info: { icon: Info, tone: "text-aqua-300" },
};

function WarningRow({ w, onAutoFix }) {
  const s = SEVERITY[w.severity] || SEVERITY.info;
  const Icon = s.icon;
  return (
    <div className="neu-inset-sm flex items-start gap-2.5 rounded-2xl px-3 py-2">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", s.tone)} />
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-slate-300">{w.message}</p>
      {w.fix ? (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onAutoFix}
          title={w.fixLabel || "Apply suggested fix"}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-mint-400/15 px-2 py-1 text-[11px] font-semibold text-mint-300 hover:bg-mint-400/25"
        >
          <Wand2 className="h-3 w-3" /> Auto fix
        </motion.button>
      ) : (
        <span className="shrink-0 font-mono text-[10px] text-slate-600" title="Manual edit only">
          manual
        </span>
      )}
    </div>
  );
}