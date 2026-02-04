import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimelineContentProps {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
  animationNum: number;
  timelineRef: React.RefObject<HTMLElement>;
  customVariants: Variants;
  className?: string;
}

export function TimelineContent({
  children,
  as: Component = "div",
  animationNum,
  timelineRef,
  customVariants,
  className,
}: TimelineContentProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    root: timelineRef,
    margin: "-100px",
    once: false,
  });

  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  const MotionComponent = motion[Component as keyof typeof motion] as typeof motion.div;

  return (
    <MotionComponent
      ref={ref}
      variants={customVariants}
      initial="hidden"
      animate={isInView || hasAnimated ? "visible" : "hidden"}
      custom={animationNum}
      className={cn(className)}
    >
      {children}
    </MotionComponent>
  );
}
