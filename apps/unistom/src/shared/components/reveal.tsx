'use client'

import { motion } from "motion/react";
import type { ComponentProps, ElementType } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;
const DURATION = 0.4;

type RevealProps = ComponentProps<typeof motion.div> & {
  as?: ElementType;
  /** delay in seconds */
  delay?: number;
};

/**
 * Entrance animation that plays once on mount. Safe inside Server Components.
 * Each element animates independently — no parent orchestration — so content
 * can never get stuck partway.
 */
export function Reveal({ as = "div", delay = 0, children, ...props }: RevealProps) {
  const Comp = (motion[as as keyof typeof motion] ?? motion.div) as typeof motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION, ease: EASE, delay }}
      {...props}
    >
      {children}
    </Comp>
  );
}

/** Plain layout wrapper — kept for API symmetry with <RevealItem>. */
export function RevealGroup({ children, ...props }: ComponentProps<"div">) {
  return <div {...props}>{children}</div>;
}

/** Self-animating grid/list item. Plays on mount, independent of siblings. */
export function RevealItem({ children, ...props }: RevealProps) {
  const { delay = 0, as = "div", ...rest } = props;
  const Comp = (motion[as as keyof typeof motion] ?? motion.div) as typeof motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
