import { motion } from "framer-motion";
import StageProgress from "../components/StageProgress";
import BrandMark from "../components/BrandMark";

export default function ProcessingView({ current, value, fileName, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-700/35 p-6 backdrop-blur-xl"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong w-full max-w-lg rounded-3xl p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center gap-4">
          <BrandMark size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{fileName}</p>
            <p className="text-xs text-slate-500">Processing locally — no data leaves your device</p>
          </div>
          <motion.div className="ml-auto flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-aqua-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-iris-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-aqua-400" />
          </motion.div>
        </div>

        <StageProgress current={current} value={value} />

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Click anywhere outside to cancel
        </p>
      </motion.div>
    </motion.div>
  );
}