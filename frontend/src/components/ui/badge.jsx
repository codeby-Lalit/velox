import { cn } from "../../lib/utils";

const tones = {
  success: "bg-mint-400/12 text-mint-300 ring-mint-400/25",
  warning: "bg-amber-400/12 text-amber-300 ring-amber-400/25",
  error: "bg-rose-400/12 text-rose-300 ring-rose-400/25",
  info: "bg-aqua-400/12 text-aqua-300 ring-aqua-400/25",
  neutral: "bg-white/[0.06] text-slate-300 ring-white/10",
  accent: "bg-iris-400/12 text-iris-300 ring-iris-400/25",
};

const dots = {
  success: "bg-mint-400",
  warning: "bg-amber-400",
  error: "bg-rose-400",
  info: "bg-aqua-400",
  neutral: "bg-slate-400",
  accent: "bg-iris-400",
};

export function Badge({ tone = "neutral", dot = true, className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset uppercase tracking-wide",
        tones[tone],
        className
      )}
      {...props}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} /> : null}
      {children}
    </span>
  );
}