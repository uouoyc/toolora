"use client";

import { Button } from "@toolora/ui/components/button";

function pageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages: (number | "...")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) {
    pages.push("...");
  }
  for (let index = left; index <= right; index += 1) {
    pages.push(index);
  }
  if (right < total - 1) {
    pages.push("...");
  }
  pages.push(total);
  return pages;
}

/** Always-visible pagination footer recipe (deconstruction §3.9). */
export function Pagination({
  onPageChange,
  onPageSizeChange,
  page,
  pageCount,
  pageSize,
}: {
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  page: number;
  pageCount: number;
  pageSize: number;
}) {
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  return (
    <div className="mt-8 flex flex-col gap-4 border-t pt-8 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-4">
        <span className="font-medium text-muted-foreground text-xs">
          每页展示
        </span>
        <select
          aria-label="每页展示"
          className="h-9 cursor-pointer rounded-lg border border-input bg-background px-3 font-bold text-xs outline-none"
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value));
          }}
          value={pageSize}
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
          className="h-9 cursor-pointer rounded-lg px-4 font-bold text-xs"
          disabled={safePage === 0}
          onClick={() => onPageChange(safePage - 1)}
          type="button"
          variant="outline"
        >
          上一页
        </Button>
        <div className="flex items-center gap-1">
          {pageNumbers(safePage + 1, pageCount).map((item, index) =>
            item === "..." ? (
              <span
                className="flex h-9 w-9 items-center justify-center text-muted-foreground text-xs"
                key={`ellipsis-${index}`}
              >
                ...
              </span>
            ) : (
              <button
                aria-current={safePage + 1 === item ? "page" : undefined}
                className={`h-9 w-9 cursor-pointer rounded-lg font-bold text-xs transition-all ${
                  safePage + 1 === item
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background hover:bg-accent"
                }`}
                key={item}
                onClick={() => onPageChange(item - 1)}
                type="button"
              >
                {item}
              </button>
            ),
          )}
        </div>
        <Button
          className="h-9 cursor-pointer rounded-lg px-4 font-bold text-xs"
          disabled={safePage + 1 >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          type="button"
          variant="outline"
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
