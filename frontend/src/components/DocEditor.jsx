import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, PenLine } from "lucide-react";
import { cn } from "../lib/utils";
import { ROLE_TYPES } from "../lib/roles";
import { SEVERITY_META } from "../lib/issues";
import { autoFix } from "../lib/roles";

const ROLE_BADGE = {
  title: "bg-iris-400/15 text-iris-300",
  chapter: "bg-iris-400/15 text-iris-300",
  section: "bg-aqua-400/15 text-aqua-300",
  subsection: "bg-aqua-400/10 text-aqua-300/90",
  subsubsection: "bg-slate-400/15 text-slate-300",
  paragraph: "bg-white/[0.04] text-slate-400",
  table_caption: "bg-mint-400/15 text-mint-300",
  figure_caption: "bg-mint-400/15 text-mint-300",
};

function strongest(issues) {
  if (!issues || !issues.length) return null;
  const rank = { error: 3, warning: 2, info: 1 };
  return [...issues].sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0))[0];
}

export default function DocEditor({
  elements = [],
  issuesByElement = {},
  overrides = {},
  onChange = () => {},
  activeIndex = null,
  focusIndex = null,
  focusSerial = 0,
  serial = 0,
  editable = true,
}) {
  const rowsRef = useRef({});
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (focusIndex === null || focusIndex === undefined) return;
    const el = rowsRef.current[focusIndex];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(focusIndex);
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [focusIndex, focusSerial]);

  const commitText = (idx, innerText) => {
    onChange(idx, { text: innerText });
  };

  return (
    <div className="space-y-1 py-2">
      {elements.map((el) => {
        if (el.kind === "table") {
          const cols = Math.min(Math.max((el.rows?.[0] || []).length, 1), 6);
          return (
            <motion.div
              key={`t-${el.source_index}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-2 my-3 rounded-xl border border-line bg-black/10 p-2"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-500">#{el.source_index}</span>
                <span className="rounded-md bg-white/[0.05] px-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  table
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-line">
                {(el.rows || []).map((row, ri) => (
                  <div key={ri} className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
                    {row.map((cell, ci) => (
                      <div
                        key={ci}
                        className="border-line px-2 py-1 text-[11px] leading-snug text-slate-300 [&:not(:last-child)]:border-r"
                      >
                        {cell.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        }

        const idx = el.source_index;
        const list = issuesByElement[idx] || [];
        const strong = strongest(list);
        const meta = strong ? SEVERITY_META[strong.severity] : null;
        const override = overrides[idx];
        const role = override?.element_type ?? el.element_type;
        const text = override?.text !== undefined ? override.text : el.text;
        const fas = focusIndex === idx;
        const flashing = flash === idx;

        return (
          <motion.div
            key={`p-${idx}-${serial}`}
            ref={(node) => (rowsRef.current[idx] = node)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "group relative mx-2 rounded-xl border-l-2 px-3 py-1.5 transition-colors",
              meta ? meta.mark + " " + meta.glow : "border-l-transparent",
              override && !meta && "border-l-amber-400/70 bg-amber-400/[0.04]",
              fas && "bg-iris-400/[0.07] ring-1 ring-iris-400/40",
              flashing && "bg-rose-400/[0.08] ring-1 ring-rose-400/50"
            )}
            onMouseEnter={() => onHover?.(idx)}
            onMouseLeave={() => onHover?.(null)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9px] leading-none text-slate-600">#{idx}</span>
              {override && (
                <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-400" title="edited locally" />
              )}
              <select
                value={role}
                onChange={(e) => onChange(idx, { element_type: e.target.value })}
                disabled={!editable}
                className={cn(
                  "cursor-pointer rounded-md border-0 bg-transparent px-1.5 py-0.5 text-[10px] font-semibold outline-none transition-colors disabled:cursor-default",
                  ROLE_BADGE[role] || ROLE_BADGE.paragraph
                )}
                title="Element role"
              >
                {ROLE_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-ink-850 text-slate-200">
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
              {override && (
                <span className="flex items-center gap-1 rounded-md bg-amber-400/10 px-1.5 text-[9px] font-semibold text-amber-300">
                  <PenLine className="h-2.5 w-2.5" /> edited
                </span>
              )}
              <span className="ml-auto font-mono text-[9px] text-slate-600">
                {strong ? `${strong.severity}` : ""}
              </span>
            </div>

            <div
              contentEditable={editable}
              suppressContentEditableWarning
              spellCheck={false}
              onInput={(e) => commitText(idx, e.currentTarget.innerText)}
              className={cn(
                "mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-slate-200 caret-aqua-300 outline-none",
                meta && "underline decoration-wavy decoration-2 underline-offset-4",
                meta && meta.underline
              )}
            >
              {text || ""}
            </div>

            {list.length > 0 && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {list.slice(0, 3).map((issue, i) => {
                      const m = SEVERITY_META[issue.severity];
                      const fix = autoFix(issue.code, issue.details);
                      return (
                        <div
                          key={`${issue.code}-${i}`}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                            m.chip
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
                          <span className="max-w-[220px] truncate">{issue.message}</span>
                          {fix && (
                            <button
                              onClick={() => onChange(idx, fix)}
                              className="inline-flex items-center gap-1 rounded-full bg-mint-400/20 px-1.5 py-0.5 font-semibold text-mint-300 hover:bg-mint-400/35"
                              title="Apply suggested fix"
                            >
                              <Wand2 className="h-2.5 w-2.5" /> Fix
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {list.length > 3 && (
                      <span className="text-[10px] text-slate-500">+{list.length - 3} more</span>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        );
      })}

      {!elements.length && (
        <div className="flex h-full items-center justify-center py-16 text-center text-sm text-slate-500">
          No document content to display.
        </div>
      )}
    </div>
  );
}