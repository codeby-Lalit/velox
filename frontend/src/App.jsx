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
import { AlertCircle, AlertTriangle, X } from "lucide-react";
import ImportView from "./views/ImportView";
import ProcessingView from "./views/ProcessingView";
import BatchResultsView from "./views/BatchResultsView";
import WorkspaceView from "./views/WorkspaceView";
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
  const [stageIdx, setStageIdx] = useState(0);
  const [value, setValue] = useState(0);
  const [openResult, setOpenResult] = useState(null);
  const [openFile, setOpenFile] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editorSerial, setEditorSerial] = useState(0);
  const [reviewPrompt, setReviewPrompt] = useState(null);

  const controllerRef = useRef(null);
  const timerRef = useRef(null);
  const jobRetryRef = useRef(false);

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

  useEffect(() => {
    // Premium motion: parallax-drift the glass orbs on scroll and give cards
    // marked [data-tilt] a live 3D tilt that follows the pointer. Registered
    // once at app root so every screen gets it.
    const root = document.documentElement;
    const onScroll = () => {
      root.style.setProperty("--parallax", `${window.scrollY * 0.05}px`);
    };
    const onMove = (e) => {
      const el = e.target && e.target.closest ? e.target.closest("[data-tilt]") : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${(px * 8).toFixed(2)}deg`);
      el.style.setProperty("--rx", `${(-py * 8).toFixed(2)}deg`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
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

  const handleReanalyze = useCallback(
    (reviews) => {
      if (!reviews || !reviews.length) return;
      startProcess(reviews, activeFile ? [activeFile] : undefined);
    },
    [startProcess, activeFile]
  );

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
    async ({ edits, message, setTitle }) => {
      setBusy(true);
      try {
        if (!result?.job_id) throw new Error("Job context lost — reprocess the document first.");
        const data = await applyEdits({ jobId: result.job_id, edits, message, setTitle });
        setResult(data);
        setEditorSerial((s) => s + 1);
        return data; // EditorView awaits to clear its submit spinner
      } catch (err) {
        // Job context died under us (dir swept after a restart / an id that
        // the old regex rejected). If we still hold the dropped source file,
        // silently recreate the context and re-apply the exact same edits
        // once — the workspace never "crashes" into the import screen.
        const lostContext = /invalid job id|job not found/i.test(err.message || "");
        if (lostContext && !jobRetryRef.current && files[0] && edits?.length) {
          jobRetryRef.current = true;
          try {
            const fresh = await processDocument({
              file: files[0],
              profileId,
              reviews: [],
              signal: null,
            });
            const data = await applyEdits({
              jobId: fresh.job_id,
              edits,
              message,
              setTitle,
            });
            setResult(data);
            setEditorSerial((s) => s + 1);
            jobRetryRef.current = false;
            return data;
          } catch (retryErr) {
            jobRetryRef.current = false;
            setError(retryErr.message || "Apply edits failed");
            setPhase("error");
            throw retryErr;
          }
        }
        setError(err.message || "Apply edits failed");
        setPhase("error");
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [result, files, profileId]
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
    const versions = openResult?.history?.versions || [];
    const head = versions[versions.length - 1];
    const resumes = (head?.edits || []).map((e) => ({
      kind: e.kind || "paragraph",
      source_index: e.source_index,
      ...(e.text !== undefined ? { text: e.text } : {}),
      ...(e.element_type !== undefined ? { element_type: e.element_type } : {}),
    }));
    setBusy(true);
    try {
      const data = await applyOpenEdits({
        file: openFile,
        edits: resumes,
        message: head ? `resumed editing on ${head.id}` : "resumed editing",
      });
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
  }, [openFile, openResult]);

  const processingLabel = useCallback(() => {
    if (files.length > 1) return `${files.length} manuscripts`;
    return files[0]?.name ?? "document.docx";
  }, [files]);

  return (
    <div className="circuit-bg min-h-full">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
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
                  <p className="mt-0.5 text-xs text-rose-500/90">{error}</p>
                </div>
                <button
                  onClick={() => setPhase("idle")}
                  className="rounded-lg p-1 text-rose-300 hover:bg-rose-500/10"
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

        {(phase === "result" || phase === "editor") && result && (
          <WorkspaceView
            key={`ws-${result.job_id || result.payload?.generated_at || "job"}-${editorSerial}`}
            result={result}
            onApply={handleEditorApply}
            onReanalyze={handleReanalyze}
            onBack={() => {
              if (activeFile) setPhase("batch");
              else setPhase("idle");
            }}
            onRunAgain={() => startProcess([], activeFile ? [activeFile] : undefined)}
            busy={busy}
            restoringId={restoringId}
            onReviewPrompt={setReviewPrompt}
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
              setPhase("result");
            }}
            onBack={() => setPhase("idle")}
            onRunAgain={() => startProcess()}
          />
        )}
      </AnimatePresence>

      {/* Low-confidence review prompt — survives the auto-fix workspace remount */}
      <AnimatePresence>
        {reviewPrompt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewPrompt(null)}
              className="absolute inset-0 bg-ink-700/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-label="Low-confidence review needed"
              className="glass-strong relative w-full max-w-md rounded-3xl p-6"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink-900">Auto-fix complete</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                    {reviewPrompt.fixed > 0
                      ? `${reviewPrompt.fixed} element${reviewPrompt.fixed === 1 ? "" : "s"} fixed and committed. `
                      : ""}
                    {reviewPrompt.low} low-confidence element{reviewPrompt.low === 1 ? "" : "s"} need
                    manual or human review — open each finding and Accept it or set the role from the
                    right panel.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setReviewPrompt(null)}
                  className="btn-ripple relative inline-flex h-9 items-center overflow-hidden rounded-xl bg-gradient-to-r from-mint-400 to-aqua-400 px-4 text-xs font-bold text-ink-950 hover:brightness-110"
                >
                  OK, review later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="mt-10 pb-8 text-center">
        <p className="mx-auto max-w-md px-4 text-[11px] text-pretty text-slate-400">
          Circuit Networks · offline deterministic engine · no cloud, no AI · HackNIMA 2026
        </p>
      </footer>
    </div>
  );
}