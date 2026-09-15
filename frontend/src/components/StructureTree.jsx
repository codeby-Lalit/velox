import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import {
  BookOpen,
  FileText,
  Layers,
  ChevronRight,
  Image,
  Table2,
  Type,
} from "lucide-react";

const typeColor = {
  title: "bg-iris-400/12 text-iris-300",
  chapter: "bg-iris-400/12 text-iris-300",
  section: "bg-aqua-400/12 text-aqua-300",
  subsection: "bg-aqua-400/08 text-aqua-300",
  subsubsection: "bg-iris-400/08 text-iris-300",
  table: "bg-amber-400/12 text-amber-300",
  table_caption: "bg-amber-400/08 text-amber-300",
  figure_caption: "bg-mint-400/08 text-mint-300",
  paragraph: "bg-white/[0.04] text-slate-400",
};

const typeIcon = {
  title: Type,
  chapter: BookOpen,
  section: BookOpen,
  subsection: ChevronRight,
  subsubsection: ChevronRight,
  table: Table2,
  table_caption: Image,
  figure_caption: Image,
  paragraph: FileText,
};

function Row({ item, index, lit }) {
  const ref = useRef(null);
  const Icon = typeIcon[item.element_type] || Layers;

  useEffect(() => {
    if (lit && ref.current) {
      ref.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [lit]);

  return (
    <motion.li
      ref={ref}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        lit
          ? "bg-aqua-400/[0.12] ring-1 ring-aqua-400/40"
          : "hover:bg-white/[0.04]"
      )}
      style={{ paddingLeft: 12 + item.depth * 22 }}
    >
      {lit && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-aqua-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />}
      <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md ring-1 ring-inset", typeColor[item.element_type] || typeColor.paragraph)}>
        <Icon className="h-3 w-3" />
      </span>
      <span className="flex-1 min-w-0 truncate text-sm text-white">
        {item.text || <span className="italic text-slate-500">untitled element</span>}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-slate-500">
        {(item.confidence * 100).toFixed(0)}%
      </span>
    </motion.li>
  );
}

export default function StructureTree({ outline, highlightIndex }) {
  if (!outline || outline.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        No headings were detected in this document.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {outline.map((item, i) => (
        <Row
          key={`${item.source_index ?? item.depth}-${i}`}
          item={item}
          index={i}
          lit={highlightIndex != null && item.source_index === highlightIndex}
        />
      ))}
    </ul>
  );
}