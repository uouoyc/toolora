import { cn } from "@toolora/ui/lib/utils";
import type { ReactNode } from "react";

/** Micro-label recipe shared by Tool pages (deconstruction §7 微标签). */
export function Microlabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[10px] text-muted-foreground uppercase tracking-widest",
        className,
      )}
    >
      {children}
    </span>
  );
}
