import { cn } from "@toolora/ui/lib/utils";
import type { ReactNode } from "react";

/** Tool result table header cell recipe (deconstruction §7 表头格). */
export function DataTableHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-4 text-[10px] text-muted-foreground uppercase tracking-widest",
        className,
      )}
    >
      {children}
    </th>
  );
}
