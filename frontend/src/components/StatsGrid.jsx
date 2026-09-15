import { motion } from "framer-motion";
import { FileText, BookOpen, Hash, ListTree, Table2, Image, AlertTriangle, Shield } from "lucide-react";

const fmt = (v) => (v ?? 0).toLocaleString();

export default function StatsGrid({ stats }) {
  const items = [
    { label: "Paragraphs", value: stats.paragraphs, icon: FileText, color: "aqua" },
    { label: "Headings", value: stats.headings, icon: BookOpen, color: "iris" },
    { label: "Tables", value: stats.tables, icon: Table2, color: "iris" },
    { label: "Captions", value: stats.captions, icon: Image, color: "iris" },
    { label: "Warnings", value: stats.preflight_warnings, icon: AlertTriangle, color: stats.preflight_warnings ? "amber" : "mint" },
    { label: "Errors", value: stats.preflight_errors, icon: AlertTriangle, color: stats.preflight_errors ? "rose" : "mint" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass rounded-2xl p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{item.label}</span>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06]">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
              </span>
            </div>
            <span className="font-mono text-2xl font-semibold tracking-tight text-white">
              {fmt(item.value)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}