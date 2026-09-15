import { motion } from "framer-motion";
import {
  ArrowLeft,
  Layers,
  Eye,
  Download,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers2,
  FileJson,
} from "lucide-react";
import { downloadUrl } from "../lib/utils";
import { Badge } from "../components/ui/badge";

function ResultCard({ item, index, onOpen }) {
  const payload = item.payload;
  const stats = payload?.processing_stats || {};
  const integrity = payload?.integrity?.status || item.integrity_status;
  const pass = integrity === "pass";
  const base = (payload?.source?.path || item.filename || "output")
    .split(/[\\/]/)
    .pop();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-iris-400/12">
          <FileText className="h-4.5 w-4.5 text-iris-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{base}</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3 w-3" />
            {stats.elapsed_ms != null ? `${(stats.elapsed_ms / 1000).toFixed(1)}s` : "—"}
            {" · "}
            {stats.paragraphs ?? "—"} paragraphs · ~{stats.pages_estimate ?? "—"} pages
          </p>
        </div>
        <Badge tone={pass ? "success" : "error"}>
          {pass ? "Verified" : "Failed"}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Headings", value: stats.headings },
          { label: "Warnings", value: stats.preflight_warnings },
          { label: "Review items", value: stats.review_items },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-ink-950/50 px-2 py-2.5">
            <p className="font-mono text-lg font-semibold text-white">{s.value ?? 0}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onOpen(item)}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-3.5 text-xs font-semibold text-ink-950 hover:brightness-110"
        >
          <Eye className="h-3.5 w-3.5" /> Open report
        </button>
        {item.output_docx && (
          <a
            href={downloadUrl(item.output_docx)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            <Download className="h-3.5 w-3.5" /> DOCX
          </a>
        )}
        {item.audit_html && (
          <a
            href={downloadUrl(item.audit_html)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            <Layers className="h-3.5 w-3.5" /> HTML
          </a>
        )}
        {item.audit_json && (
          <a
            href={downloadUrl(item.audit_json)}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            <FileJson className="h-3.5 w-3.5" /> JSON
          </a>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[11px] text-slate-500">
        {pass ? (
          <ShieldCheck className="h-3.5 w-3.5 text-mint-400" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
        )}
        {item.error
          ? `${item.stage || "process"} · ${item.error}`
          : `SHA-256 verified · content preserved (R4/R8) · ${payload?.engine?.name} v${payload?.engine?.version}`}
      </div>
    </motion.div>
  );
}

export default function BatchResultsView({ results, onOpen, onBack, onRunAgain }) {
  const passed = results.filter((r) => r.integrity_status === "pass").length;
  const failed = results.length - passed;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-5xl px-6 py-8"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line text-slate-400 hover:bg-white/[0.06] hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white">Batch results</p>
          <p className="text-xs text-slate-500">
            F107 · {results.length} manuscripts · {passed} verified · {failed} failed
          </p>
        </div>
        <button
          onClick={onRunAgain}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
        >
          <Layers2 className="h-3.5 w-3.5" /> Reprocess batch
        </button>
      </div>

      <div className="space-y-4">
        {results.map((item, i) => (
          <ResultCard key={item.filename || i} item={item} index={i} onOpen={onOpen} />
        ))}
      </div>
    </motion.div>
  );
}