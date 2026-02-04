import React from "react";
import { cn } from "@/lib/utils";

interface ProgressiveBlurProps {
  className?: string;
  blurIntensity?: number;
}

export function ProgressiveBlur({
  className,
  blurIntensity = 0.5,
}: ProgressiveBlurProps) {
  return (
    <div
      className={cn(
        "absolute inset-0",
        "bg-gradient-to-t from-black/50 via-transparent to-transparent",
        className
      )}
      style={{
        backdropFilter: `blur(${blurIntensity * 10}px)`,
        WebkitBackdropFilter: `blur(${blurIntensity * 10}px)`,
      }}
    />
  );
}





