import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, Wand2 } from "lucide-react";
import { cn } from "../lib/utils";
import { ROLE_TYPES } from "../lib/roles";
import { SEVERITY_META } from "../lib/issues";
import { autoFix } from "../lib/roles";

/* F110: unified live preview with inline editing.
   Renders the document as a light "paper" page styled by semantic role.
   Type in place: while focused the text stays in a local draft (the DOM is
   authoritative), so the caret never jumps; on blur the draft commits to an
   override and the element lights up amber. Any local edit — typing text,
   changing the role, a suggested Fix, or Auto-Fix All — is visually marked. */
const ROLE_STYLE = {
  title: "text-center text-[26px] font-bold leading-snug text-gray-950",
  chapter: "text-[22px] font-bold leading-snug text-gray-950 mt-8 first:mt-0",
  section: "text-[17px] font-semibold leading-snug text-gray-900 mt-6 first:mt-0",
  subsection: "text-[15px] font-semibold italic leading-snug text-gray-800 mt-5 first:mt-0",
  subsubsection: "text-[14px] font-medium text-gray-800 mt-4 first:mt-0",
  table_caption:
    "text-center text-[12px] italic text-gray-700 mt-6 first:mt-0",
  figure_caption:
    "text-center text-[12px] italic text-gray-700 mt-2 first:mt-0",
  paragraph: "text-[13px] leading-[1.65] text-justify text-gray-800 first:mt-0 text-pretty",
};

const ROLE_BADGE = {
  title: "bg-iris-400/15 text-iris-300",
  chapter: "bg-iris-400/15 text-iris-300",
  section: "bg-aqua-400/15 text-aqua-300",
  subsection: "bg-aqua-400/10 text-aqua-300/90",
  subsubsection: "bg-slate-400/15 text-slate-300",
  paragraph: "bg-slate-800/20 text-slate-500",
  table_caption: "bg-mint-400/15 text-mint-300",
  figure_caption: "bg-mint-400/15 text-mint-300",
};

function strongest(issues) {
  if (!issues || !issues.length) return null;
  const rank = { error: 3, warning: 2, info: 1 };
  return [...issues].sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0))[0];
}

export default function DocPreview({
  elements = [],
  overrides = {},
  issuesByElement = {},
  onChange = () => {},
  onHover = () => {},
  focusIndex = null,
  focusSerial = 0,
  manualIndex = null,
  onManualHandled = () => {},
  editable = true,
}) {
  const rowsRef = useRef({});
  const draftRef = useRef(new Map());
  const [flash, setFlash] = useState(null);
  const [hovering, setHovering] = useState(null);
  const [caret, setCaret] = useState(null);

  useEffect(() => {
    if (focusIndex === null || focusIndex === undefined) return;
    const el = rowsRef.current[focusIndex];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(focusIndex);
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [focusIndex, focusSerial]);

  const rows = elements || [];
  if (!rows.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-gray-100 p-10 text-center text-sm text-gray-400">
        Nothing to preview yet — edit a paragraph to see it reflected here.
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="neu-inset-sm mx-auto w-full max-w-[680px] py-6"
    >
      <div className="rounded-xl bg-gray-50 px-6 py-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] sm:px-12 sm:py-12">
        <div className="space-y-2">
          {rows.map((el) => {
            if (el.kind === "table") {
              const cols = Math.min(Math.max((el.rows?.[0] || []).length, 1), 6);
              const idx = el.source_index;
              const edited = overrides && overrides[idx];
              return (
                <div
                  key={`t-${idx}`}
                  className={cn(
                    "relative my-4 first:mt-0",
                    edited && "rounded bg-amber-50 px-1 ring-1 ring-amber-400/60"
                  )}
                >
                  <div className="absolute -top-2 right-0 flex items-center gap-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 shadow ring-1 ring-black/5">
                    <span>#{idx}</span>
                    {edited && (
                      <span className="inline-flex items-center gap-0.5 font-sans font-semibold text-amber-600">
                        <PenLine className="h-2.5 w-2.5" /> edited
                      </span>
                    )}
                  </div>
                  <div className="overflow-hidden rounded border border-gray-300">
                    {(el.rows || []).map((row, ri) => (
                      <div
                        key={ri}
                        className="grid"
                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                      >
                        {row.map((cell, ci) => (
                          <div
                            key={ci}
                            className={cn(
                              "border-gray-300 px-2 py-1 text-[11px] leading-snug text-gray-800 [&:not(:last-child)]:border-r",
                              ri > 0 && "border-t"
                            )}
                          >
                            {cell.text}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            const idx = el.source_index;
            const list = issuesByElement[idx] || [];
            const override = overrides[idx];
            const role = override?.element_type ?? el.element_type;
            const text = override?.text !== undefined ? override.text : el.text;

            return (
              <EditableBlock
                key={`p-${idx}`}
                idx={idx}
                el={el}
                text={text}
                role={role}
                override={override}
                issues={list}
                editing={caret === idx}
                focused={focusIndex === idx}
                flashing={flash === idx}
                hovering={hovering === idx}
                manual={manualIndex === idx}
                onManualHandled={onManualHandled}
                editable={editable}
                draftRef={draftRef}
                onChange={onChange}
                onHover={onHover}
                onFocus={() => setCaret(idx)}
                onBlur={() => setCaret((c) => (c === idx ? null : c))}
                setRow={(node) => {
                  rowsRef.current[idx] = node;
                }}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* Memoized paragraph block: only re-renders when its own props change, so a
   re-render elsewhere (hover effects, chips) never rewrites the text node and
   never steals the caret while the user is typing. */
const EditableBlock = memo(function EditableBlock({
  idx,
  el,
  text,
  role,
  override,
  issues,
  editing,
  focused,
  flashing,
  hovering,
  manual,
  onManualHandled,
  editable,
  draftRef,
  onChange,
  onHover,
  onFocus,
  onBlur,
  setRow,
}) {
  const drafted = draftRef.current.get(idx);
  const shown = drafted !== undefined ? drafted : text;
  const meta = strongest(issues);
  const m = meta ? SEVERITY_META[meta.severity] : null;
  const active = hovering || Boolean(override) || focused || editing || flashing || manual;
  const style = ROLE_STYLE[role] || ROLE_STYLE.paragraph;
  const blockRef = useRef(null);

  useEffect(() => {
    // F200 "Manual": bring the element up and put the caret inside it so the
    // reviewer can set the role / edit the text themselves instead of using the
    // suggested Accept/Reject classification. focused contentEditable already
    // shows the editing ring, so no extra styling is needed here.
    if (manual && blockRef.current) {
      blockRef.current.focus({ preventScroll: true });
      onManualHandled?.();
    }
  }, [manual, onManualHandled]);

  const commit = () => {
    const draft = draftRef.current.get(idx);
    if (draft === undefined) return;
    draftRef.current.delete(idx);
    onChange(idx, { text: draft });
  };

  return (
    <motion.div
      ref={setRow}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative"
      onMouseEnter={() => onHover?.(idx)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div
        ref={blockRef}
        contentEditable={editable}
        suppressContentEditableWarning
        spellCheck={false}
        onFocus={(e) => {
          onFocus?.();
          if (draftRef.current.get(idx) === undefined) {
            draftRef.current.set(idx, e.currentTarget.innerText || "");
          }
        }}
        onBlur={() => {
          commit();
          onBlur?.();
        }}
        onClick={onFocus}
        onInput={(e) => draftRef.current.set(idx, e.currentTarget.innerText)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && draftRef.current.has(idx)) {
            draftRef.current.delete(idx);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "whitespace-pre-wrap break-words rounded px-1 outline-none caret-rose-500 transition-shadow",
          style,
          override && "bg-amber-50 ring-2 ring-inset ring-amber-400/70",
          !override && editing && "ring-2 ring-inset ring-iris-400 bg-iris-50",
          flashing && "ring-2 ring-inset ring-rose-400 bg-rose-50",
          hovering && !override && !editing && !flashing && "ring-2 ring-inset ring-aqua-400/80 bg-aqua-400/10",
          editable ? "cursor-text" : "cursor-default"
        )}
      >
        {shown || "…"}
      </div>

      {active && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -top-2.5 right-0 z-10 flex flex-wrap items-center gap-1.5 rounded-md bg-white/95 px-1.5 py-1 text-[10px] shadow ring-1 ring-black/5"
        >
          <span className="font-mono text-slate-500">#{idx}</span>
          <select
            value={role}
            disabled={!editable}
            onChange={(e) => onChange(idx, { element_type: e.target.value })}
            className={cn(
              "cursor-pointer rounded border-0 bg-transparent px-1 py-0.5 text-[11px] font-semibold outline-none disabled:cursor-default",
              ROLE_BADGE[role] || ROLE_BADGE.paragraph
            )}
            title="Element role (manual formatting)"
          >
            {ROLE_TYPES.map((t) => (
              <option key={t} value={t} className="bg-white text-slate-300">
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
          {(override || drafted !== undefined) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-1.5 py-0.5 font-sans font-semibold text-amber-600">
              <PenLine className="h-2.5 w-2.5" /> edited
            </span>
          )}
          {m && (
            <span className={cn("rounded px-1 font-mono", m.chip)}>{m.label}</span>
          )}
        </motion.div>
      )}

      {active && issues.length > 0 && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {issues.slice(0, 3).map((issue, i) => {
                const mm = SEVERITY_META[issue.severity];
                const fix = autoFix(issue.code, issue.details, shown);
                return (
                  <div
                    key={`${issue.code}-${i}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                      mm.chip
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", mm.dot)} />
                    <span className="max-w-[220px] min-w-0 truncate">{issue.message}</span>
                    {fix && (
                      <button
                        onClick={() => {
                          commit();
                          onChange(idx, fix);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-mint-400/20 px-1.5 py-0.5 font-semibold text-mint-300 hover:bg-mint-400/35"
                        title="Apply suggested fix"
                      >
                        <Wand2 className="h-2.5 w-2.5" /> Fix
                      </button>
                    )}
                  </div>
                );
              })}
              {issues.length > 3 && (
                <span className="text-[11px] text-slate-400">+{issues.length - 3} more</span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  );
});