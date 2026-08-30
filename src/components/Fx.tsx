"use client";

import { motion, useMotionValue, useSpring, useTransform, type Variants } from "motion/react";
import type { ReactNode, CSSProperties, PointerEvent } from "react";

/* Shared Motion primitives, 3D edition: elements enter through
   perspective space (tilted back, below, slightly deep) and spring
   upright. Games' 60fps canvases stay hand-rolled. */

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 26, z: -80, rotateX: -32, transformPerspective: 900 },
  show: {
    opacity: 1,
    y: 0,
    z: 0,
    rotateX: 0,
    transformPerspective: 900,
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
};

export function Stagger({
  children, className, delay = 0, style,
}: {
  children: ReactNode; className?: string; delay?: number; style?: CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={{ transformStyle: "preserve-3d", ...style }}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function Item({
  children, className, style,
}: {
  children: ReactNode; className?: string; style?: CSSProperties;
}) {
  return (
    <motion.div className={className} style={style} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/** Verdict entrance: flips up from deep in the scene. */
export function Pop({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8, rotateX: 40, transformPerspective: 700 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0, transformPerspective: 700 }}
      transition={{ type: "spring", stiffness: 380, damping: 21 }}
    >
      {children}
    </motion.div>
  );
}

/** Pointer-tracked 3D tilt — wrap a card and it leans toward the cursor. */
export function Tilt({
  children, className, style, max = 10,
}: {
  children: ReactNode; className?: string; style?: CSSProperties; max?: number;
}) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 260, damping: 20 });
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 260, damping: 20 });

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;   // no tilt-jitter while scrolling
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => { px.set(0.5); py.set(0.5); };

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 700, transformStyle: "preserve-3d", ...style }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </motion.div>
  );
}
