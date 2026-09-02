import type { ReactNode } from "react";
import { Microlabel } from "@/components/microlabel";

/** Render inside a `<dl>` grid; each card is one term/value pair. */
export function MetricCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-3xl border bg-card p-4 sm:p-6">
      <dt>
        <Microlabel>{label}</Microlabel>
      </dt>
      <dd className="font-bold text-2xl tabular-nums tracking-tighter sm:text-4xl">
        {value}
      </dd>
    </div>
  );
}
