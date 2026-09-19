import { motion } from "framer-motion";
import { Play, Zap, WifiOff, Cpu, ShieldCheck, FolderOpen } from "lucide-react";
import Dropzone from "../components/Dropzone";
import { Badge } from "../components/ui/badge";
import BrandMark from "../components/BrandMark";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" } }),
};

export default function ImportView({
  files,
  onFiles,
  profiles,
  profileId,
  setProfileId,
  onStart,
  onOpen,
  busy,
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-16">
      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="show" custom={0} className="text-center">
        <div className="mb-5 inline-flex items-center gap-3.5">
          <BrandMark size={46} />
          <div className="text-left">
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">
              Circuit Networks
            </h1>
            <p className="text-xs text-slate-500">Intelligent manuscript processing</p>
          </div>
        </div>
        <motion.div variants={fadeUp} custom={1} className="mx-auto max-w-xl">
          <h2 className="text-grad text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            From messy manuscript to publication-ready DOCX
          </h2>
          <p className="mt-3 text-balance text-[15px] leading-relaxed text-slate-400">
            Circuit Networks infers your document's structure, flags issues, and formats it to a
            publisher's exact profile — all on your machine.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} custom={2} className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Badge tone="success"><WifiOff className="h-3 w-3" /> 100% offline</Badge>
          <Badge tone="info"><Cpu className="h-3 w-3" /> Deterministic engine</Badge>
          <Badge tone="accent"><ShieldCheck className="h-3 w-3" /> Integrity verified</Badge>
        </motion.div>
      </motion.header>

      {/* Workspace */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={3}
        className="mt-12 grid gap-6 lg:grid-cols-[1.35fr_1fr]"
      >
        <div className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-ink-900">Import manuscript</h3>
              <p className="text-xs text-slate-400">Step 1 — choose your .docx file</p>
            </div>
            <Badge tone="info" dot={false}>Step 1 · 3</Badge>
          </div>
          <Dropzone files={files} onFiles={onFiles} />
        </div>

        <div className="flex flex-col gap-6">
          {/* Profile picker (F103) */}
<div className="tilt tilt-static glass rounded-2xl p-6" data-tilt>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-ink-900">Publisher profile</h3>
              <Badge tone="accent" dot={false}>F103</Badge>
            </div>
            <div className="space-y-2">
              {profiles.map((p) => {
                const selected = profileId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProfileId(p.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-[background-color,border-color] ${
                      selected
                        ? "border-aqua-400/50 bg-aqua-400/[0.07]"
                        : "border-line bg-white/45 hover:bg-white/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink-900">{p.name}</span>
                      {selected && (
                        <motion.span
                          layoutId="profile-dot"
                          className="h-2 w-2 rounded-full bg-aqua-400"
                        />
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-0.5 max-w-[62ch] text-pretty text-xs text-slate-500">{p.description}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.section>

      {/* CTA */}
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={4} className="mt-8 text-center">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          disabled={!files.length || busy}
          onClick={onStart}
          className="group inline-flex h-13 items-center gap-3 rounded-2xl bg-gradient-to-r from-aqua-400 via-iris-400 to-iris-400 px-8 text-[15px] font-semibold text-ink-950 relative overflow-hidden btn-ripple transition-[filter,opacity,transform] hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Zap className="h-4.5 w-4.5 transition-transform group-hover:rotate-12" />
          {files.length > 1 ? `Analyze & Format ${files.length} files` : "Analyze & Format"}
        </motion.button>
        <p className="mt-3 text-xs text-slate-500">
          {files.length === 0
            ? "Select a manuscript to enable processing"
            : files.length === 1
              ? `Ready to process "${files[0].name}"`
              : `${files.length} manuscripts ready for batch processing (F107)`}
        </p>
      </motion.div>

      {/* Open an existing .velox document (F112) */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={5}
        className="mx-auto mt-10 max-w-2xl"
      >
        <div className="rounded-3xl border border-line bg-white/45 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink-900">Open a .velox document</h3>
              <p className="text-xs text-slate-500">
                Resume editing a <span className="font-mono">*_velox.docx</span> — full history restored (F112)
              </p>
            </div>
            <Badge tone="accent" dot={false}>F112</Badge>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer?.files?.[0];
              if (f) onOpen(f);
            }}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-500/70 p-4 transition-colors hover:border-aqua-400/50"
          >
            <input
              id="velox-open-file"
              type="file"
              accept=".docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onOpen(f);
                e.target.value = "";
              }}
              className="hidden"
            />
            <label htmlFor="velox-open-file" className="flex cursor-pointer items-center gap-3">
              <FolderOpen className="h-5 w-5 text-aqua-300" />
              <span className="text-[13px] text-slate-300">
                Drop your <span className="font-mono text-aqua-300">_velox.docx</span> here or{" "}
                <span className="font-semibold text-ink-900 underline underline-offset-2">browse</span>
              </span>
            </label>
          </div>
        </div>
      </motion.div>
    </div>
  );
}