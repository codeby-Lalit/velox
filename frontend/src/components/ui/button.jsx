import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "text-white bg-gradient-to-r from-aqua-400 via-iris-400 to-iris-400 shadow-glow hover:brightness-110",
  ghost:
    "text-slate-300 border border-line bg-white/[0.03] hover:bg-white/[0.07] hover:text-white",
  outline:
    "text-slate-300 border border-aqua-400/40 bg-aqua-400/5 hover:bg-aqua-400/10 hover:text-aqua-300",
  danger:
    "text-rose-300 border border-rose-400/40 bg-rose-400/5 hover:bg-rose-400/10",
  success:
    "text-mint-300 border border-mint-400/40 bg-mint-400/5 hover:bg-mint-400/10",
};

const sizes = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2",
  icon: "h-9 w-9",
};

const Button = forwardRef(({ className, variant = "ghost", size = "md", children, ...props }, ref) => (
  <motion.button
    ref={ref}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.97 }}
    transition={{ type: "spring", stiffness: 400, damping: 22 }}
    className={cn(
      "inline-flex items-center justify-center rounded-xl font-medium tracking-tight",
      "disabled:pointer-events-none disabled:opacity-45",
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  >
    {children}
  </motion.button>
));
Button.displayName = "Button";

export { Button };