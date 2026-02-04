import React from "react";
import { cn } from "@/lib/utils";

interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowIntensity?: "sm" | "md" | "lg";
  shadowIntensity?: "sm" | "md" | "lg";
  borderRadius?: string;
  blurIntensity?: "sm" | "md" | "lg";
}

const glowClasses = {
  sm: "shadow-[0_0_15px_rgba(59,130,246,0.3)]",
  md: "shadow-[0_0_25px_rgba(59,130,246,0.5)]",
  lg: "shadow-[0_0_40px_rgba(59,130,246,0.7)]",
};

const shadowClasses = {
  sm: "shadow-lg",
  md: "shadow-xl",
  lg: "shadow-2xl",
};

const blurClasses = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur-md",
  lg: "backdrop-blur-lg",
};

export function LiquidGlassCard({
  children,
  className,
  glowIntensity = "md",
  shadowIntensity = "md",
  borderRadius = "12px",
  blurIntensity = "md",
}: LiquidGlassCardProps) {
  return (
    <div
      className={cn(
        "relative",
        "bg-gradient-to-br from-white/10 via-white/5 to-white/0",
        "border border-white/20",
        blurClasses[blurIntensity],
        glowClasses[glowIntensity],
        shadowClasses[shadowIntensity],
        "overflow-hidden",
        className
      )}
      style={{ borderRadius }}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}





