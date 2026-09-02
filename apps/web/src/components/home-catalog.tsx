"use client";

import { Button, buttonVariants } from "@toolora/ui/components/button";
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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { HighlightedText } from "@/components/highlighted-text";
import { Microlabel } from "@/components/microlabel";
import {
  filterTools,
  formatCategoryCount,
  type ToolCategory,
  type ToolManifestItem,
} from "@/lib/tools";

const ALL_TOOLS = "全部工具";
const ALL_KEY = "__all__";

function categoryKey(category: ToolCategory | null) {
  return category ?? ALL_KEY;
}

export function HomeCatalog({ tools }: { tools: readonly ToolManifestItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ToolCategory | null>(null);
  const [contentMotion, setContentMotion] = useState<{
    dir: 1 | -1;
    key: string;
  } | null>(null);
  const [indicator, setIndicator] = useState<{
    height: number;
    top: number;
  } | null>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const categories = useMemo(
    () => [...new Set(tools.map((tool) => tool.category))],
    [tools],
  );
  const visibleTools = filterTools(tools, { query, category });
  const activeKey = categoryKey(category);

  const measureIndicator = useCallback(() => {
    const button = buttonRefs.current.get(activeKey);
    if (!button) {
      setIndicator(null);
      return;
    }
    setIndicator({ height: button.offsetHeight, top: button.offsetTop });
  }, [activeKey]);

  useLayoutEffect(measureIndicator, [measureIndicator]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIndicatorReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(measureIndicator);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [measureIndicator]);

  useEffect(() => {
    function focusSearch(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function selectCategory(next: ToolCategory | null) {
    if (next === category) {
      return;
    }
    const order = [ALL_KEY, ...categories];
    const dir =
      order.indexOf(categoryKey(next)) >= order.indexOf(activeKey) ? 1 : -1;
    setCategory(next);
    setContentMotion({ dir, key: `${categoryKey(next)}-${Date.now()}` });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-6 lg:px-6">
      <search className="grid items-stretch gap-4 rounded-[2rem] border bg-card/50 p-6 sm:p-8 md:grid-cols-[200px_1fr_140px]">
        <div className="hidden flex-col justify-center rounded-2xl border bg-background/50 px-6 py-3 md:flex">
          <Microlabel className="mb-1">命令</Microlabel>
          <span className="font-bold text-lg tracking-tight">搜索架</span>
          <span className="mt-1 text-[10px] text-muted-foreground">
            ⌘ + K / Ctrl + K
          </span>
        </div>
        <label className="group relative" htmlFor="tool-search">
          <span className="sr-only">搜索工具</span>
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted-foreground transition-colors group-focus-within:text-primary">
            <Search aria-hidden="true" className="size-5" />
          </div>
          <Input
            className="h-full min-h-13 w-full rounded-2xl border-border bg-background/80 pr-4 pl-12 font-medium text-lg outline-none transition-all focus-visible:border-primary focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10 md:text-lg dark:bg-background/80 dark:focus-visible:bg-background"
            id="tool-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索工具..."
            ref={searchInputRef}
            type="text"
            value={query}
          />
        </label>
        <Button
          className="h-full min-h-13 cursor-pointer gap-2 rounded-2xl text-sm"
          onClick={() => searchInputRef.current?.focus()}
          type="button"
        >
          搜索
          <ArrowUpRight aria-hidden="true" className="size-[18px]" />
        </Button>
      </search>

      <div className="mt-12 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside
          aria-label="工具分类"
          className="relative space-y-2 lg:sticky lg:top-8"
          ref={navRef}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-0 z-0 rounded-xl bg-primary shadow-lg shadow-primary/20",
              indicatorReady &&
                "transition-[height,transform] duration-300 ease-out motion-reduce:transition-none",
              indicator ? "opacity-100" : "opacity-0",
            )}
            style={
              indicator
                ? {
                    height: `${indicator.height}px`,
                    transform: `translateY(${indicator.top}px)`,
                  }
                : undefined
            }
          />
          <CategoryButton
            active={category === null}
            buttonRef={(element) => {
              registerButton(ALL_KEY, element);
            }}
            count={tools.length}
            icon={<Grid2X2 aria-hidden="true" />}
            label={ALL_TOOLS}
            onClick={() => selectCategory(null)}
          />
          {categories.map((item) => (
            <CategoryButton
              active={category === item}
              buttonRef={(element) => {
                registerButton(item, element);
              }}
              count={tools.filter((tool) => tool.category === item).length}
              icon={<Search aria-hidden="true" />}
              key={item}
              label={item}
              onClick={() => selectCategory(item)}
            />
          ))}
        </aside>

        <section aria-labelledby="catalog-title">
          <div
            className={
              contentMotion
                ? cn(
                    "fade-in animate-in duration-300 motion-reduce:animate-none",
                    contentMotion.dir > 0
                      ? "slide-in-from-right-4"
                      : "slide-in-from-left-4",
                  )
                : undefined
            }
            key={contentMotion?.key ?? "initial"}
          >
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
              <Empty className="min-h-60 rounded-2xl border border-dashed">
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
          </div>
        </section>
      </div>
    </main>
  );

  function registerButton(key: string, element: HTMLButtonElement | null) {
    if (element) {
      buttonRefs.current.set(key, element);
    } else {
      buttonRefs.current.delete(key);
    }
  }
}

function CategoryButton({
  active,
  buttonRef,
  count,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  buttonRef: (element: HTMLButtonElement | null) => void;
  count: number;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "group relative z-10 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors",
        active
          ? "text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      onClick={onClick}
      ref={buttonRef}
      type="button"
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg transition-colors [&_svg]:size-4",
          active
            ? "bg-primary-foreground/10"
            : "bg-muted group-hover:bg-background",
        )}
      >
        {icon}
      </span>
      <span className="font-semibold">{label}</span>
      <span
        className={cn(
          "ml-auto text-[10px]",
          active ? "opacity-70" : "text-muted-foreground",
        )}
      >
        {formatCategoryCount(count)}
      </span>
    </button>
  );
}

function ToolCard({ query, tool }: { query: string; tool: ToolManifestItem }) {
  return (
    <article className="group flex flex-col rounded-3xl border bg-card p-5 transition-all duration-300 hover:border-primary/20 hover:bg-accent/50 hover:shadow-2xl hover:shadow-primary/5">
      <h2 className="mb-2 font-bold text-xl tracking-tight transition-colors group-hover:text-primary">
        <HighlightedText query={query} text={tool.name} />
      </h2>
      <p className="mb-6 grow text-muted-foreground text-sm leading-relaxed">
        <HighlightedText query={query} text={tool.description} />
      </p>
      <div className="mb-6 flex flex-wrap gap-2">
        {tool.tags.map((tag) => (
          <span
            className="inline-flex h-5 items-center rounded-4xl border px-2 text-[10px]"
            key={tag}
          >
            {tag}
          </span>
        ))}
      </div>
      <Link
        className={cn(buttonVariants(), "w-full rounded-lg text-sm")}
        href={{ pathname: `/${tool.slug}` }}
      >
        打开
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </article>
  );
}
