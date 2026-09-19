import { cn } from "../../lib/utils";

export function Progress({ value, className, barClassName }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-800/15", className)}
    >
      <div
        className={cn(
          "h-full w-full origin-left rounded-full bg-gradient-to-r from-aqua-400 to-iris-400 transition-transform duration-300 ease-out",
          barClassName
        )}
        style={{ transform: `scaleX(${Math.min(100, Math.max(0, value)) / 100})` }}
      />
    </div>
  );
}