import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, UploadCloud, X } from "lucide-react";
import { cn, formatBytes } from "../lib/utils";

export default function Dropzone({ files, onFiles }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const open = () => inputRef.current?.click();

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const picked = [...e.dataTransfer.files].filter(
      (f) => f.name.toLowerCase().endsWith(".docx")
    );
    if (picked.length) onFiles([...files, ...picked]);
  };

  const remove = (name) => onFiles(files.filter((f) => f.name !== name));

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = [...e.target.files].filter((f) =>
            f.name.toLowerCase().endsWith(".docx")
          );
          if (picked.length) onFiles([...files, ...picked]);
          e.target.value = "";
        }}
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
          Drop your manuscript{files.length ? "s" : ""} here
        </p>
        <p className="mt-1 text-sm text-slate-400">
          or <span className="font-medium text-aqua-300 underline underline-offset-2">browse</span> for{" "}
          <code className="font-mono text-xs">.docx</code> file{files.length ? "s" : ""}{" "}
          <span className="text-slate-500">(multi-select = batch)</span>
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Processed entirely on this device — content never leaves your machine
        </p>

        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-6 space-y-2 rounded-xl px-4 py-3 text-left ring-1 ring-line bg-white/[0.04]"
              onClick={(e) => e.stopPropagation()}
            >
              {files.map((file, i) => (
                <motion.div
                  key={file.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between gap-3"
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
                    onClick={() => remove(file.name)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-rose-300"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
              {files.length > 1 && (
                <button
                  onClick={() => onFiles([])}
                  className="w-full rounded-lg px-3 py-1.5 text-center text-[11px] font-medium text-slate-400 hover:bg-white/10 hover:text-rose-300"
                >
                  Clear all ({files.length})
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}