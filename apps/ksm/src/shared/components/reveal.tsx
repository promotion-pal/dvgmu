import type { ComponentProps, CSSProperties, ElementType } from "react";
import { cn } from "@/shared/lib/utils";

type RevealProps = {
  as?: ElementType;
  /** delay in seconds */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
} & Omit<ComponentProps<"div">, "style">;

/**
 * Entrance animation driven entirely by CSS (`.reveal` in globals.css).
 * Because it is CSS, the final state is always applied — content can never
 * get stuck invisible if JS is slow, disabled or throws during hydration.
 * Safe in Server Components.
 */
export function Reveal({
  as,
  delay = 0,
  className,
  style,
  children,
  ...props
}: RevealProps) {
  const Comp = (as ?? "div") as ElementType;
  return (
    <Comp
      className={cn("reveal", className)}
      style={delay ? { ...style, animationDelay: `${delay}s` } : style}
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

/** Self-animating grid/list item. Same CSS reveal as <Reveal>. */
export function RevealItem({
  as,
  delay = 0,
  className,
  style,
  children,
  ...props
}: RevealProps) {
  const Comp = (as ?? "div") as ElementType;
  return (
    <Comp
      className={cn("reveal", className)}
      style={delay ? { ...style, animationDelay: `${delay}s` } : style}
      {...props}
    >
      {children}
    </Comp>
  );
}
