import { useCallback, useRef, useState } from "react";
import { cn } from "../lib/utils";

/* Draggable split-pane divider (react-resizable-panels-style, dependency-free). */
export default function ResizeSplit({
  left,
  right,
  leftClassName = "",
  rightClassName = "",
  className = "",
  ratio: controlledRatio,
  onRatio,
}) {
  const containerRef = useRef(null);
  const [dragRatio, setDragRatio] = useState(null);
  const draggingRef = useRef(false);

  const ratio =
    controlledRatio !== undefined
      ? controlledRatio
      : dragRatio !== null
        ? dragRatio
        : 0.38;

  const down = useCallback(
    (e) => {
      e.preventDefault();
      draggingRef.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const move = (ev) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const next = (ev.clientX - rect.left) / Math.max(rect.width, 1);
        const clamped = Math.min(0.62, Math.max(0.28, next));
        setDragRatio(clamped);
        onRatio?.(clamped);
      };
      const up = () => {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [onRatio]
  );

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0 w-full items-stretch", className)}
    >
      <div className={cn("min-w-0 overflow-hidden", leftClassName)} style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        onPointerDown={down}
        role="separator"
        aria-orientation="vertical"
        className="group relative z-10 w-1.5 shrink-0 cursor-col-resize"
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover:bg-iris-400/60 group-active:bg-iris-400" />
        <div className="absolute inset-y-0 right-1/2 hidden w-6 -translate-x-1/2 group-hover:block" />
      </div>
      <div className={cn("min-w-0 overflow-hidden", rightClassName)} style={{ width: `${(1 - ratio) * 100}%` }}>
        {right}
      </div>
    </div>
  );
}