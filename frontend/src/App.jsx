import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchProfiles, processDocument } from "./lib/api";
import { AlertCircle, X } from "lucide-react";
import ImportView from "./views/ImportView";
import ProcessingView from "./views/ProcessingView";
import ResultsView from "./views/ResultsView";

const STAGE_IDS = ["parse", "classify", "preflight", "format", "integrity", "report"];
const STAGE_MS = 650;

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [file, setFile] = useState(null);
  const [profileId, setProfileId] = useState("default");
  const [phase, setPhase] = useState("idle"); // idle | processing | result | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [decisions, setDecisions] = useState(new Map());
  const [stageIdx, setStageIdx] = useState(0);
  const [value, setValue] = useState(0);

  const controllerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchProfiles()
      .then((p) => {
        setProfiles(p);
        if (p.length && !p.some((x) => x.id === profileId)) setProfileId(p[0].id);
      })
      .catch(() => setProfiles([]));
  }, [profileId]);

  const stopAnimation = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => stopAnimation, []);

  const startProcess = useCallback(async (reviews = []) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setPhase("processing");
    setStageIdx(0);
    setValue(2);
    setDecisions(new Map());

    const controller = new AbortController();
    controllerRef.current = controller;

    // advance the staged pipeline animation while the engine works
    let idx = 0;
    timerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, STAGE_IDS.length);
      setStageIdx(idx);
      setValue((idx / STAGE_IDS.length) * 92);
    }, STAGE_MS);

    try {
      const data = await processDocument({
        file,
        profileId,
        reviews,
        signal: controller.signal,
      });
      stopAnimation();
      setStageIdx(STAGE_IDS.length - 1);
      setValue(100);
      setResult(data);
      setTimeout(() => setPhase("result"), 350);
    } catch (err) {
      if (err.name === "AbortError") return;
      stopAnimation();
      setError(err.message || "Processing failed");
      setPhase("error");
    }
  }, [file, profileId, stopAnimation]);

  const handleDecision = useCallback((sourceIndex, action, newElementType) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(sourceIndex, { source_index: sourceIndex, action, new_element_type: newElementType ?? null });
      return next;
    });
  }, []);

  const resetDecisions = useCallback(() => setDecisions(new Map()), []);

  const commitDecisions = useCallback(() => {
    const reviews = [...decisions.values()];
    if (reviews.length) startProcess(reviews);
  }, [decisions, startProcess]);

  const cancelProcessing = useCallback(() => {
    stopAnimation();
    controllerRef.current?.abort();
    setPhase("idle");
  }, [stopAnimation]);

  return (
    <div className="circuit-bg min-h-full">
      <AnimatePresence mode="wait">
        {(phase === "idle" || phase === "error") && (
          <motion.div key="import">
            {phase === "error" && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto mt-6 flex max-w-2xl items-start gap-3 rounded-2xl border border-rose-400/40 bg-rose-400/10 px-5 py-4"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-rose-300">Processing failed</p>
                  <p className="mt-0.5 text-xs text-rose-200/80">{error}</p>
                </div>
                <button
                  onClick={() => setPhase("idle")}
                  className="rounded-lg p-1 text-rose-300 hover:bg-white/10"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )}
            <ImportView
              file={file}
              onFile={setFile}
              profiles={profiles}
              profileId={profileId}
              setProfileId={setProfileId}
              onStart={() => startProcess()}
            />
          </motion.div>
        )}

        {phase === "processing" && (
          <ProcessingView
            fileName={file?.name ?? "document.docx"}
            current={STAGE_IDS[stageIdx]}
            value={value}
            onCancel={cancelProcessing}
          />
        )}

        {phase === "result" && result && (
          <ResultsView
            key={result.payload.generated_at}
            result={result}
            decisions={decisions}
            onDecision={handleDecision}
            onResetDecisions={resetDecisions}
            onReProcess={commitDecisions}
            onBack={() => setPhase("idle")}
            onRunAgain={() => startProcess()}
          />
        )}
      </AnimatePresence>

      <footer className="mt-10 pb-8 text-center">
        <p className="text-[11px] text-slate-600">
          Circuit Networks · offline deterministic engine · no cloud, no AI · HackNIMA 2026
        </p>
      </footer>
    </div>
  );
}