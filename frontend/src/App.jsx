import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  fetchProfiles,
  processDocument,
  processBatch,
  applyEdits,
  openVelox,
  applyOpenEdits,
} from "./lib/api";
import { AlertCircle, X } from "lucide-react";
import ImportView from "./views/ImportView";
import ProcessingView from "./views/ProcessingView";
import ResultsView from "./views/ResultsView";
import BatchResultsView from "./views/BatchResultsView";
import EditorView from "./views/EditorView";
import OpenedView from "./views/OpenedView";

const STAGE_IDS = ["parse", "classify", "preflight", "format", "integrity", "report"];
const STAGE_MS = 650;

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [files, setFiles] = useState([]);
  const [profileId, setProfileId] = useState("default");
  const [phase, setPhase] = useState("idle"); // idle | processing | result | batch | error | editor | opened
  const [result, setResult] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [error, setError] = useState(null);
  const [decisions, setDecisions] = useState(new Map());
  const [stageIdx, setStageIdx] = useState(0);
  const [value, setValue] = useState(0);
  const [openResult, setOpenResult] = useState(null);
  const [openFile, setOpenFile] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editorSerial, setEditorSerial] = useState(0);

  const controllerRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetchProfiles()
      .then((p) => {
        if (!active) return;
        setProfiles(p);
        if (p.length && !p.some((x) => x.id === profileId)) setProfileId(p[0].id);
      })
      .catch(() => active && setProfiles([]));
    return () => {
      active = false;
    };
  }, []);

  const stopAnimation = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => stopAnimation, []);

  const beginProcessing = useCallback(() => {
    setError(null);
    setResult(null);
    setBatchResults([]);
    setPhase("processing");
    setStageIdx(0);
    setValue(2);
    setDecisions(new Map());

    const controller = new AbortController();
    controllerRef.current = controller;

    let idx = 0;
    timerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, STAGE_IDS.length);
      setStageIdx(idx);
      setValue((idx / STAGE_IDS.length) * 92);
    }, STAGE_MS);
    return controller;
  }, [stopAnimation]);

  const finishProcessing = useCallback((phaseName, data) => {
    stopAnimation();
    setStageIdx(STAGE_IDS.length - 1);
    setValue(100);
    if (phaseName === "result") {
      setResult(data);
      setBatchResults([]);
    } else {
      setResult(null);
      setBatchResults(data.results || []);
    }
    setTimeout(() => setPhase(phaseName), 350);
  }, [stopAnimation]);

  const startProcess = useCallback(
    async (reviews = [], filesOverride) => {
      const active = filesOverride && filesOverride.length ? filesOverride : files;
      if (!active || active.length === 0) return;
      const controller = beginProcessing();

      try {
        if (active.length === 1) {
          const data = await processDocument({
            file: active[0],
            profileId,
            reviews,
            signal: controller.signal,
          });
          finishProcessing("result", data);
        } else {
          const data = await processBatch({
            files: active,
            profileId,
            signal: controller.signal,
          });
          finishProcessing("batch", data);
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        stopAnimation();
        setError(err.message || "Processing failed");
        setPhase("error");
      }
    },
    [files, profileId, beginProcessing, finishProcessing, stopAnimation]
  );

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
    if (reviews.length) startProcess(reviews, activeFile ? [activeFile] : undefined);
  }, [decisions, startProcess, activeFile]);

  const cancelProcessing = useCallback(() => {
    stopAnimation();
    controllerRef.current?.abort();
    setPhase("idle");
  }, [stopAnimation]);

  const handleOpenVelox = useCallback(async (file) => {
    setError(null);
    setBusy(true);
    try {
      const data = await openVelox(file);
      setOpenResult(data);
      setOpenFile(file);
      setPhase("opened");
    } catch (err) {
      setError(err.message || "Could not open .velox document");
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleEditorApply = useCallback(
    async ({ edits, message }) => {
      setBusy(true);
      try {
        if (!result?.job_id) throw new Error("Job context lost — reprocess the document first.");
        const data = await applyEdits({ jobId: result.job_id, edits, message });
        setResult(data);
        setEditorSerial((s) => s + 1);
        return data; // EditorView awaits to clear its submit spinner
      } catch (err) {
        setError(err.message || "Apply edits failed");
        setPhase("error");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [result]
  );

  const handleOpenedRestore = useCallback(
    async ({ edits, message }) => {
      if (!openFile) {
        setError("Keep the .velox file in the app to restore — re-drop it first.");
        setPhase("opened");
        return;
      }
      setBusy(true);
      setRestoringId(message);
      try {
        const data = await applyOpenEdits({ file: openFile, edits, message });
        setResult(data);
        setOpenResult(null);
        setOpenFile(null);
        setRestoringId(null);
        setEditorSerial((s) => s + 1);
        setPhase("editor");
      } catch (err) {
        setRestoringId(null);
        setError(err.message || "Restore failed");
        setPhase("opened");
      } finally {
        setBusy(false);
      }
    },
    [openFile]
  );

  const handleResumeEditing = useCallback(async () => {
    if (!openFile) {
      setError("Re-drop the .velox file to resume editing.");
      setPhase("opened");
      return;
    }
    setBusy(true);
    try {
      const data = await applyOpenEdits({ file: openFile, edits: [], message: "resumed editing" });
      setResult(data);
      setOpenResult(null);
      setOpenFile(null);
      setEditorSerial((s) => s + 1);
      setPhase("editor");
    } catch (err) {
      setError(err.message || "Could not resume");
      setPhase("opened");
    } finally {
      setBusy(false);
    }
  }, [openFile]);

  const processingLabel = useCallback(() => {
    if (files.length > 1) return `${files.length} manuscripts`;
    return files[0]?.name ?? "document.docx";
  }, [files]);

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
              files={files}
              onFiles={setFiles}
              profiles={profiles}
              profileId={profileId}
              setProfileId={setProfileId}
              onStart={() => startProcess()}
              onOpen={handleOpenVelox}
              busy={busy}
            />
          </motion.div>
        )}

        {phase === "processing" && (
          <ProcessingView
            fileName={processingLabel()}
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
            onBack={() => (activeFile ? setPhase("batch") : setPhase("idle"))}
            onRunAgain={() => startProcess([], activeFile ? [activeFile] : undefined)}
            onEdit={() => {
              setEditorSerial((s) => s + 1);
              setPhase("editor");
            }}
            busy={busy}
          />
        )}

        {phase === "editor" && result && (
          <EditorView
            key={`editor-${result.job_id || result.payload.generated_at}-${editorSerial}`}
            result={result}
            onApply={handleEditorApply}
            onBack={() => (result?.job_id ? setPhase("result") : setPhase("idle"))}
            onRunAgain={() => startProcess([], activeFile ? [activeFile] : undefined)}
            busy={busy}
            restoringId={restoringId}
          />
        )}

        {phase === "opened" && openResult && (
          <OpenedView
            openResult={openResult}
            onBack={() => {
              setOpenResult(null);
              setOpenFile(null);
              setPhase("idle");
            }}
            onRestore={handleOpenedRestore}
            onResume={handleResumeEditing}
            busy={busy}
            restoringId={restoringId}
          />
        )}

        {phase === "batch" && batchResults.length > 0 && (
          <BatchResultsView
            results={batchResults}
            onOpen={(res) => {
              if (!res.payload) {
                // R9: a failed item has no payload — show its error instead of crashing.
                setError(res.error || res.integrity_status || "Processing failed");
                setPhase("error");
                return;
              }
              const matched = files.find((f) => f.name === res.filename);
              setActiveFile(matched ?? null);
              setResult(res);
              setDecisions(new Map());
              setPhase("result");
            }}
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