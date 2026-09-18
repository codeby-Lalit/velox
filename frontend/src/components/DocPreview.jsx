import { motion } from "framer-motion";
import { cn } from "../lib/utils";

/* F110: live preview of the document, styled by semantic role.
   Rendered as a light "paper" page that reflects local overrides instantly. */
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

export default function DocPreview({ elements, overrides = {} }) {
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
      className="neu-inset-sm mx-auto w-full max-w-[620px] rounded-2xl p-3 sm:p-5"
    >
      <div className="rounded-xl bg-gray-50 px-6 py-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] sm:px-12 sm:py-12">
        <div className="space-y-2">
          {rows.map((el, i) => {
            if (el.kind === "table") {
              const cols = Math.min(Math.max((el.rows?.[0] || []).length, 1), 6);
              return (
                <div key={`t-${el.source_index}`} className="my-4 first:mt-0">
                  <div className="overflow-hidden rounded border border-gray-300">
                    {(el.rows || []).map((row, ri) => (
                      <div key={ri} className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
            const ov = overrides[el.source_index];
            const text = ov?.text !== undefined ? ov.text : el.text;
            const role = ov?.element_type || el.element_type;
            const style = ROLE_STYLE[role] || ROLE_STYLE.paragraph;
            return (
              <p
                key={`p-${el.source_index}`}
                className={cn(style, ov && "rounded bg-amber-50 ring-1 ring-amber-400/50 px-1")}
              >
                {text || "…"}
              </p>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}