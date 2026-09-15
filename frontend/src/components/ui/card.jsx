import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn("glass rounded-2xl p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, title, subtitle, icon, action }) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}