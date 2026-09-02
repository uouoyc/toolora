import { cn } from "@toolora/ui/lib/utils";
import type { ReactNode } from "react";

const PILL_TONES = {
  error: "bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
  success: "bg-green-500/10 text-green-600 dark:text-green-400",
  warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
} as const;

export function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: keyof typeof PILL_TONES;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 font-bold text-[10px]",
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
