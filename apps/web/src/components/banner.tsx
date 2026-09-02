import { cn } from "@toolora/ui/lib/utils";
import type { ReactNode } from "react";

const BANNER_TONES = {
  error: "border-destructive/20 bg-destructive/10 text-destructive",
  warning:
    "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
} as const;

export function Banner({
  children,
  role = "status",
  tone,
}: {
  children: ReactNode;
  role?: "alert" | "status";
  tone: keyof typeof BANNER_TONES;
}) {
  return (
    <p
      className={cn(
        "rounded-2xl border p-4 font-medium text-sm",
        BANNER_TONES[tone],
      )}
      role={role}
    >
      {children}
    </p>
  );
}
