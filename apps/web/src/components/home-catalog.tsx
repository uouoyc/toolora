"use client";

import { Button, buttonVariants } from "@toolora/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@toolora/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@toolora/ui/components/empty";
import { Input } from "@toolora/ui/components/input";
import { cn } from "@toolora/ui/lib/utils";
import { ArrowUpRight, Grid2X2, Search } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { HighlightedText } from "@/components/highlighted-text";
import {
  filterTools,
  type ToolCategory,
  type ToolManifestItem,
} from "@/lib/tools";

const ALL_TOOLS = "全部工具";

export function HomeCatalog({ tools }: { tools: readonly ToolManifestItem[] }) {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | null>(null);
  const categories = useMemo(
    () => [...new Set(tools.map((tool) => tool.category))],
    [tools],
  );
  const visibleTools = filterTools(tools, { query, category });

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("tool-search")?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(queryInput.trim());
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-4 sm:px-6 lg:px-6">
      <form
        className="grid gap-4 rounded-[2rem] border bg-card/50 p-6 sm:p-8 md:grid-cols-[200px_1fr_140px] md:items-stretch"
        onSubmit={handleSearch}
      >
        <div className="flex min-h-24 flex-col justify-center rounded-2xl border bg-muted/30 px-5">
          <span className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.18em]">
            命令
          </span>
          <strong className="mt-2 text-lg">搜索架</strong>
          <span className="mt-1 text-muted-foreground text-xs">
            ⌘ + K / Ctrl + K
          </span>
        </div>
        <label
          className="relative flex min-h-16 items-center sm:min-h-24"
          htmlFor="tool-search"
        >
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-5 size-5 text-muted-foreground"
          />
          <span className="sr-only">搜索工具</span>
          <Input
            className="h-full min-h-16 rounded-2xl pl-14 font-medium text-lg sm:min-h-24 md:text-lg"
            id="tool-search"
            onChange={(event) => setQueryInput(event.target.value)}
            placeholder="搜索工具..."
            value={queryInput}
          />
        </label>
        <Button
          className="min-h-14 cursor-pointer rounded-2xl text-sm sm:min-h-24"
          type="submit"
        >
          搜索
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </form>

      <div className="mt-12 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside aria-label="工具分类" className="space-y-2">
          <CategoryButton
            active={category === null}
            count={tools.length}
            icon={<Grid2X2 aria-hidden="true" />}
            label={ALL_TOOLS}
            onClick={() => setCategory(null)}
          />
          {categories.map((item) => (
            <CategoryButton
              active={category === item}
              count={tools.filter((tool) => tool.category === item).length}
              key={item}
              icon={<Search aria-hidden="true" />}
              label={item}
              onClick={() => setCategory(item)}
            />
          ))}
        </aside>

        <section aria-labelledby="catalog-title">
          <h1
            className="mb-6 font-bold text-3xl tracking-tight"
            id="catalog-title"
          >
            {category ?? ALL_TOOLS}
          </h1>

          {visibleTools.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleTools.map((tool) => (
                <ToolCard key={tool.slug} query={query} tool={tool} />
              ))}
            </div>
          ) : (
            <Empty className="min-h-64 rounded-2xl border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>没有匹配的工具</EmptyTitle>
                <EmptyDescription>
                  换一个关键词，或清除分类筛选后再试。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </main>
  );
}

function CategoryButton({
  active,
  count,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg [&_svg]:size-4",
          active ? "bg-primary-foreground/10" : "bg-muted",
        )}
      >
        {icon}
      </span>
      <span className="font-medium">{label}</span>
      <span className="ml-auto text-xs opacity-70">
        {String(count).padStart(2, "0")}
      </span>
    </button>
  );
}

function ToolCard({ query, tool }: { query: string; tool: ToolManifestItem }) {
  return (
    <Card className="rounded-3xl py-5 transition-shadow hover:shadow-md">
      <CardHeader className="px-5">
        <CardTitle className="font-bold text-xl">
          <HighlightedText query={query} text={tool.name} />
        </CardTitle>
        <CardDescription className="min-h-12 text-sm">
          <HighlightedText query={query} text={tool.description} />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2 px-5">
        {tool.tags.map((tag) => (
          <span
            className="rounded-full border px-2.5 py-1 text-[0.65rem] uppercase tracking-wide"
            key={tag}
          >
            {tag}
          </span>
        ))}
      </CardContent>
      <CardFooter className="border-0 px-5 pt-3">
        <Link
          className={cn(buttonVariants(), "h-10 w-full rounded-xl text-sm")}
          href={{ pathname: `/${tool.slug}` }}
        >
          打开
          <ArrowUpRight data-icon="inline-end" />
        </Link>
      </CardFooter>
    </Card>
  );
}
