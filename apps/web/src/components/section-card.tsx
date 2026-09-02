import { cn } from "@toolora/ui/lib/utils";
import type { ReactNode } from "react";

/** Flat section card recipe shared by Tool pages (deconstruction §7 区块卡). */
export function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("min-w-0 rounded-[2rem] border bg-card p-8", className)}
    >
      {children}
    </section>
  );
}
