"use client";

import { useMemo } from "react";

import { useTranslations } from "next-intl";

interface RankerMetricsProps {
  total: number;
  found: number;
  missed: number;
  failed: number;
}

export function RankerMetrics({
  total,
  found,
  missed,
  failed,
}: RankerMetricsProps) {
  const t = useTranslations("keywordRanking");

  const items = useMemo(
    () => [
      { label: t("metrics.total"), value: total },
      { label: t("metrics.found"), value: found },
      { label: t("metrics.missed"), value: missed },
      { label: t("metrics.failed"), value: failed },
    ],
    [t, total, found, missed, failed],
  );

  return (
    <div className="grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="border-border bg-card flex flex-col rounded-3xl border p-6"
        >
          <p className="text-muted-foreground mb-2 font-mono text-[10px] tracking-widest uppercase">
            {item.label}
          </p>
          <p className="text-4xl font-bold tracking-tighter">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
