import { cn } from "@/lib/utils";

type TextShimmerProps = {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  as?: keyof JSX.IntrinsicElements;
};

function TextShimmer({
  children,
  className,
  duration = 1.5,
  as: Component = "span",
}: TextShimmerProps) {
  return (
    <Component
      className={cn(
        "inline-block bg-clip-text text-transparent animate-text-shimmer",
        "bg-[length:200%_100%] bg-[position:100%_50%]",
        className
      )}
      style={
        {
          "--shimmer-duration": `${duration}s`,
          backgroundImage:
            "linear-gradient(90deg, var(--base-color, currentColor) 0%, var(--base-gradient-color, rgba(255,255,255,0.8)) 50%, var(--base-color, currentColor) 100%)",
        } as React.CSSProperties
      }
    >
      {children}
    </Component>
  );
}

export { TextShimmer };
