import { cn } from "@toolora/ui/lib/utils";
import type { ReactNode } from "react";

export function Field({
  children,
  className,
  htmlFor,
  label,
}: {
  children: ReactNode;
  className?: string;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className={cn("grid gap-4 text-sm", className)} htmlFor={htmlFor}>
      <span className="font-bold">{label}</span>
      {children}
    </label>
  );
}

export const toolInputClassName =
  "h-12 rounded-xl bg-background/50 px-4 text-base focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 md:text-base";
export const toolSelectClassName =
  "h-12 w-full cursor-pointer rounded-xl border border-border bg-background/50 px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/20";
export const toolTextareaClassName =
  "h-36 max-h-36 min-h-36 rounded-xl bg-background/50 px-4 py-3 text-base leading-relaxed [field-sizing:fixed] focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 md:text-base";
