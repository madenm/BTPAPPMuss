import React from "react";
import { motion, MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface VerticalCutRevealProps {
  children: string;
  splitBy?: "words" | "chars";
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center";
  reverse?: boolean;
  containerClassName?: string;
  transition?: MotionProps["transition"];
}

export default function VerticalCutReveal({
  children,
  splitBy = "words",
  staggerDuration = 0.1,
  staggerFrom = "first",
  reverse = false,
  containerClassName,
  transition,
}: VerticalCutRevealProps) {
  const items = splitBy === "words" ? children.split(" ") : children.split("");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDuration,
        staggerDirection: reverse ? -1 : 1,
      },
    },
  };

  const itemVariants = {
    hidden: {
      clipPath: "inset(100% 0 0 0)",
      opacity: 0,
    },
    visible: {
      clipPath: "inset(0% 0 0 0)",
      opacity: 1,
      transition: transition || {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const orderedItems =
    staggerFrom === "last"
      ? [...items].reverse()
      : staggerFrom === "center"
      ? [...items].sort(() => Math.random() - 0.5)
      : items;

  return (
    <motion.span
      className={cn("inline-flex flex-wrap", containerClassName)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {orderedItems.map((item, index) => (
        <motion.span
          key={`${item}-${index}`}
          variants={itemVariants}
          className="inline-block"
          style={{ overflow: "hidden" }}
        >
          {splitBy === "words" ? `${item} ` : item}
        </motion.span>
      ))}
    </motion.span>
  );
}





