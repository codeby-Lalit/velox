import { motion } from "framer-motion";

export default function BrandMark({ size = 40 }) {
  const ring = {
    hidden: { rotate: 0 },
    animate: { rotate: 360 },
  };
  return (
    <motion.div
      aria-hidden
      className="relative grid place-items-center rounded-2xl bg-gradient-to-br from-white/[0.07] via-ink-800 to-white/[0.02] ring-1 ring-white/10"
      style={{ width: size, height: size }}
    >
      <motion.svg
        variants={ring}
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 24 24"
        fill="none"
        stroke="url(#brandGrad)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id="brandGrad" x1="0" y1="0" x2="24" y2="24">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="2.4" />
        <circle cx="12" cy="5" r="1.7" />
        <circle cx="19" cy="12" r="1.7" />
        <circle cx="12" cy="19" r="1.7" />
        <circle cx="5" cy="12" r="1.7" />
        <path d="M12 6.7v2.9M13.8 13.8l3.4 1.9M10.2 13.8l-3.4 1.9M12 17.3V14.9M17.3 12h-2.9M8.7 12H5.9" />
      </motion.svg>
    </motion.div>
  );
}