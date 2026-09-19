/* Monochromatic soft accuracy ring. */
export default function AccuracyRing({ value = 0, size = 88 }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const tone =
    pct >= 90 ? "stroke-mint-300" : pct >= 75 ? "stroke-iris-300" : "stroke-amber-300";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={7}
          className="stroke-slate-800/15"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={`${tone} drop-shadow-[0_0_6px_rgba(165,180,252,0.2)] transition-[stroke-dasharray,color] duration-500`}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-mono text-lg font-bold text-ink-900 leading-none">{Math.round(pct)}</p>
        <p className="mt-0.5 text-[11px] uppercase tracking-widest text-slate-400">ready</p>
      </div>
    </div>
  );
}