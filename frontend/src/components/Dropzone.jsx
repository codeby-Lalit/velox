import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn, formatBytes } from "../lib/utils";

export default function Dropzone({ file, onFile }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const open = () => inputRef.current?.click();

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <motion.div
        onClick={open}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        animate={{
          borderColor: drag ? "rgba(103,232,249,0.6)" : "rgba(148,163,184,0.16)",
          backgroundColor: drag ? "rgba(34,211,238,0.06)" : "rgba(255,255,255,0.02)",
        }}
        whileHover={{ scale: 1.005 }}
        className="relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors"
      >
        <motion.div
          animate={drag ? { scale: 1.12, rotate: 4 } : { scale: 1, rotate: 0 }}
          className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-aqua-400/10 ring-1 ring-aqua-400/30"
        >
          <UploadCloud className="h-7 w-7 text-aqua-300" />
        </motion.div>
        <p className="text-[15px] font-medium text-white">
          Drop your manuscript here
        </p>
        <p className="mt-1 text-sm text-slate-400">
          or <span className="font-medium text-aqua-300 underline underline-offset-2">browse</span> for a{" "}
          <code className="font-mono text-xs">.docx</code> file
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Processed entirely on this device — content never leaves your machine
        </p>

        <AnimatePresence>
          {file && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={cn(
                "mt-6 flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left",
                "bg-white/[0.04] ring-1 ring-line"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-iris-400/12">
                  <FileText className="h-4.5 w-4.5 text-iris-300" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                </div>
              </div>
              <button
                onClick={() => onFile(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-rose-300"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}