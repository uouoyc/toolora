import { useTranslations } from "next-intl";

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type KeyHealthRow, type ResultRow } from "@/lib/keyword-ranking";

interface RankerResultsProps {
  results: ResultRow[];
  allResults: ResultRow[];
  currentPage: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onExportWithKey: () => Promise<KeyHealthRow[]>;
}

function buildCsv(
  rows: RankerResultsProps["results"],
  withKey: boolean,
  t: (key: string) => string,
): string {
  const headers = withKey
    ? [
        t("results.keyword"),
        t("results.rank"),
        t("results.url"),
        t("results.key"),
        t("results.status"),
      ]
    : [
        t("results.keyword"),
        t("results.rank"),
        t("results.url"),
        t("results.status"),
      ];

  const csvRows = rows.map((row) => {
    const cells = withKey
      ? [row.keyword, row.rank, row.url, row.keyAlias, row.status]
      : [row.keyword, row.rank, row.url, row.status];
    return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
  });

  return [headers.join(","), ...csvRows, ""].join("\n");
}

/* Build the health section for export+key CSV */
function buildKeyHealthSection(
  healthRows: KeyHealthRow[],
  t: (key: string) => string,
): string {
  if (healthRows.length === 0) return "";

  const headers = [
    t("settings.health.key"),
    t("settings.health.remaining"),
    t("settings.health.total"),
    t("settings.health.plan"),
    t("settings.health.rateUsed"),
    t("settings.health.status"),
  ];

  const rows = healthRows.map((row) =>
    [
      row.alias,
      row.remaining,
      row.total,
      row.plan,
      `${row.rateUsed} / ${row.rateLimit}`,
      t(
        `settings.health.${row.status === "rate_limited" ? "rateLimited" : row.status}`,
      ),
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(","),
  );

  return ["", "---", "", headers.join(","), ...rows].join("\n");
}

/* Encode content as UTF-8 with BOM for Excel compatibility */
function encodeCsv(content: string): Blob {
  return new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8;" });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getPageNumbers(
  current: number,
  total: number,
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export function RankerResults({
  results,
  allResults,
  currentPage,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  onExportWithKey,
}: RankerResultsProps) {
  const t = useTranslations("keywordRanking");
  const totalPages = Math.ceil(total / pageSize);

  if (allResults.length === 0) return null;

  const handleExport = () => {
    const csv = buildCsv(allResults, false, (key) => t(key));
    const ts = new Date().toISOString().slice(0, 10);
    downloadBlob(encodeCsv(csv), `keyword-ranking-${ts}.csv`);
  };

  const handleExportWithKey = async () => {
    const csv = buildCsv(allResults, true, (key) => t(key));
    const healthRows = await onExportWithKey();
    const healthSection = buildKeyHealthSection(healthRows, (key) => t(key));
    const fullCsv = csv + healthSection;
    const ts = new Date().toISOString().slice(0, 10);
    downloadBlob(encodeCsv(fullCsv), `keyword-ranking-${ts}-with-key.csv`);
  };

  return (
    <section className="border-border bg-card overflow-hidden rounded-[2rem] border p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h3 className="text-2xl font-bold tracking-tight">
          {t("results.title")}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="cursor-pointer gap-2"
          >
            {t("results.export")}
          </Button>
          <Button
            onClick={handleExportWithKey}
            className="cursor-pointer gap-2"
          >
            {t("results.exportWithKey")}
            <ArrowUpRight size={14} />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-border border-b">
              <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                {t("results.keyword")}
              </th>
              <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                {t("results.rank")}
              </th>
              <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                {t("results.url")}
              </th>
              <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                {t("results.key")}
              </th>
              <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                {t("results.status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {results.map((row) => (
              <tr
                key={`${row.keyword}-${row.keyAlias}`}
                className="hover:bg-accent/30 transition-colors"
              >
                <td className="px-4 py-4 font-medium">{row.keyword}</td>
                <td className="px-4 py-4 font-mono">{row.rank}</td>
                <td className="text-muted-foreground max-w-50 truncate px-4 py-4 text-sm">
                  {row.url}
                </td>
                <td className="text-muted-foreground px-4 py-4 font-mono text-xs">
                  {row.keyAlias}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      row.status === "found"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : row.status === "miss"
                          ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {row.status === "found"
                      ? t("metrics.found")
                      : row.status === "miss"
                        ? t("metrics.missed")
                        : t("metrics.failed")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-border mt-8 flex flex-col gap-4 border-t pt-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-xs font-medium">
            {t("results.rowsPerPage")}
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border-input bg-background h-9 rounded-lg border px-3 text-xs font-bold outline-none"
          >
            {[10, 20, 30, 40, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-9 cursor-pointer gap-2 rounded-lg px-4 text-xs font-bold"
          >
            {t("results.prev")}
          </Button>
          <div className="flex items-center gap-1">
            {getPageNumbers(currentPage, totalPages).map((page, i) =>
              page === "..." ? (
                <span
                  key={`ellipsis-${i}`}
                  className="text-muted-foreground flex h-9 w-9 items-center justify-center text-xs"
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page as number)}
                  className={`h-9 w-9 rounded-lg text-xs font-bold transition-all ${
                    currentPage === page
                      ? "bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-accent border"
                  }`}
                >
                  {page}
                </button>
              ),
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-9 cursor-pointer gap-2 rounded-lg px-4 text-xs font-bold"
          >
            {t("results.next")}
          </Button>
        </div>
      </div>
    </section>
  );
}
