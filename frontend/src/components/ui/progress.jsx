import { cn } from "../../lib/utils";

export function Progress({ value, className, barClassName }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-aqua-400 to-iris-400 transition-[width] duration-300 ease-out",
          barClassName
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}