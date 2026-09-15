import { motion } from "framer-motion";
import { Play, Zap, WifiOff, Cpu, ShieldCheck } from "lucide-react";
import Dropzone from "../components/Dropzone";
import { Badge } from "../components/ui/badge";
import BrandMark from "../components/BrandMark";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" } }),
};

export default function ImportView({ file, onFile, profiles, profileId, setProfileId, onStart, busy }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-16">
      {/* Header */}
      <motion.header variants={fadeUp} initial="hidden" animate="show" custom={0} className="text-center">
        <div className="mb-5 inline-flex items-center gap-3.5">
          <BrandMark size={46} />
          <div className="text-left">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Circuit <span className="text-gradient">Networks</span>
            </h1>
            <p className="text-xs text-slate-500">Intelligent manuscript processing</p>
          </div>
        </div>
        <motion.div variants={fadeUp} custom={1} className="mx-auto max-w-xl">
          <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            From messy manuscript to{" "}
            <span className="text-gradient">publication-ready</span> DOCX
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
              <h3 className="text-[15px] font-semibold text-white">Import manuscript</h3>
              <p className="text-xs text-slate-400">Step 1 — choose your .docx file</p>
            </div>
            <Badge tone="info" dot={false}>Step 1 · 3</Badge>
          </div>
          <Dropzone file={file} onFile={onFile} />
        </div>

        <div className="flex flex-col gap-6">
          {/* Profile picker (F103) */}
          <div className="glass rounded-2xl p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-white">Publisher profile</h3>
              <Badge tone="accent" dot={false}>F103</Badge>
            </div>
            <div className="space-y-2">
              {profiles.map((p) => {
                const selected = profileId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProfileId(p.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                      selected
                        ? "border-aqua-400/50 bg-aqua-400/[0.07]"
                        : "border-line bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      {selected && (
                        <motion.span
                          layoutId="profile-dot"
                          className="h-2 w-2 rounded-full bg-aqua-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"
                        />
                      )}
                    </div>
                    {p.description && (
                      <p className="mt-0.5 text-xs text-slate-500">{p.description}</p>
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
          disabled={!file || busy}
          onClick={onStart}
          className="group inline-flex h-13 items-center gap-3 rounded-2xl bg-gradient-to-r from-aqua-400 via-iris-400 to-iris-400 px-8 text-[15px] font-semibold text-white shadow-glow transition-all hover:brightness-110 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Zap className="h-4.5 w-4.5 transition-transform group-hover:rotate-12" />
          Analyze & Format
        </motion.button>
        <p className="mt-3 text-xs text-slate-500">
          {file
            ? `Ready to process "${file.name}"`
            : "Select a manuscript to enable processing"}
        </p>
      </motion.div>
    </div>
  );
}