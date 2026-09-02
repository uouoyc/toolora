"use client";

import {
  type KeywordRankingInput,
  KeywordRankingInputSchema,
  type KeywordRankingResult,
  normalizeKeywords,
} from "@toolora/api/contracts/keyword-ranking";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@toolora/ui/components/alert-dialog";
import { Button } from "@toolora/ui/components/button";
import { Input } from "@toolora/ui/components/input";
import { Textarea } from "@toolora/ui/components/textarea";
import { ArrowUpRight, Download, Pause, Play, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/banner";
import { DataTableHead } from "@/components/data-table-head";
import {
  Field,
  toolInputClassName,
  toolSelectClassName,
  toolTextareaClassName,
} from "@/components/field";
import { MetricCard } from "@/components/metric-card";
import { Microlabel } from "@/components/microlabel";
import { Pagination } from "@/components/pagination";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import { client } from "@/utils/orpc";
import {
  isSerpApiCountry,
  isSerpApiLanguage,
  SERPAPI_COUNTRIES,
  SERPAPI_LANGUAGES,
} from "../serpapi-settings/locales";
import { settingsForRun } from "../serpapi-settings/run-settings";
import { SerpApiSettingsSheet } from "../serpapi-settings/serpapi-settings-sheet";
import {
  isEligible,
  loadSettings,
  SERP_API_SETTINGS_CHANGED_EVENT,
  selectBatchKeys,
} from "../serpapi-settings/settings";
import {
  planKeywordBatches,
  runFailedBatches,
  runInitialBatches,
} from "./runner";
import {
  keywordRankingWorkspaceStorage,
  loadWorkspace,
  retrySaveWorkspace,
  saveWorkspace,
} from "./storage";
import {
  bindSuccessfulKeywords,
  createWorkspace,
  type FailedKeyword,
  type KeywordRankingWorkspace as KeywordRankingWorkspaceState,
  pruneKeywordBindings,
  summarizeResults,
  workspaceCsv,
} from "./workspace";

type FormState = {
  country: string;
  keywords: string;
  language: string;
  searchDepth: "10" | "20" | "30" | "40" | "50";
  targetDomain: string;
};

const EMPTY_FORM: FormState = {
  country: "us",
  keywords: "",
  language: "en",
  searchDepth: "10",
  targetDomain: "",
};

function formFromInput(input: KeywordRankingInput): FormState {
  return {
    country: input.country,
    keywords: input.keywords.join("\n"),
    language: input.language,
    searchDepth: String(input.searchDepth) as FormState["searchDepth"],
    targetDomain: input.targetDomain,
  };
}

function mergeResults(
  workspace: KeywordRankingWorkspaceState,
  incoming: readonly KeywordRankingResult[],
) {
  const byKeyword = new Map(
    workspace.results.map((result) => [result.keyword, result]),
  );
  for (const result of incoming) {
    byKeyword.set(result.keyword, result);
  }
  return workspace.input.keywords.flatMap((keyword) => {
    const result = byKeyword.get(keyword);
    return result ? [result] : [];
  });
}

function resultCount(workspace: KeywordRankingWorkspaceState) {
  return workspace.results.length;
}

export function KeywordRankingWorkspace() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [workspace, setWorkspace] =
    useState<KeywordRankingWorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageDialog, setStorageDialog] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const workspaceRef = useRef<KeywordRankingWorkspaceState | null>(null);
  const pauseRef = useRef(false);

  function persist(next: KeywordRankingWorkspaceState) {
    workspaceRef.current = next;
    setWorkspace(next);
    void saveWorkspace(keywordRankingWorkspaceStorage, next).then((result) => {
      if (!result.persisted) {
        setUnsaved(true);
        setStorageDialog(true);
      }
    });
  }

  useEffect(() => {
    let active = true;
    void loadWorkspace().then((saved) => {
      if (!active || !saved) {
        return;
      }
      workspaceRef.current = saved;
      setWorkspace(saved);
      setForm(formFromInput(saved.input));
      if (saved.run.status === "paused") {
        void saveWorkspace(keywordRankingWorkspaceStorage, saved);
      }
    });
    const syncHasKeys = () => {
      setHasKeys(loadSettings(window.localStorage).keys.length > 0);
    };
    syncHasKeys();
    window.addEventListener(SERP_API_SETTINGS_CHANGED_EVENT, syncHasKeys);
    return () => {
      active = false;
      window.removeEventListener(SERP_API_SETTINGS_CHANGED_EVENT, syncHasKeys);
      pauseRef.current = true;
    };
  }, []);

  const summary = workspace ? summarizeResults(workspace.results) : null;
  const pageCount = workspace
    ? Math.ceil(workspace.results.length / pageSize)
    : 0;
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const visibleResults =
    workspace?.results.slice(
      safePage * pageSize,
      safePage * pageSize + pageSize,
    ) ?? [];
  const keywordCount = normalizeKeywords(form.keywords.split(/\r?\n/)).length;
  const estimatedAttempts =
    keywordCount * Math.ceil(Number(form.searchDepth) / 10);
  const formIncomplete =
    !form.targetDomain.trim() ||
    keywordCount === 0 ||
    !isSerpApiCountry(form.country) ||
    !isSerpApiLanguage(form.language);
  const running = workspace?.run.status === "running";
  const startDisabled = formIncomplete || !hasKeys || running;

  function parseForm() {
    const parsed = KeywordRankingInputSchema.safeParse({
      country: form.country,
      keywords: form.keywords.split(/\r?\n/),
      language: form.language,
      searchDepth: Number(form.searchDepth),
      targetDomain: form.targetDomain,
    });
    if (
      !parsed.success ||
      !isSerpApiCountry(form.country) ||
      !isSerpApiLanguage(form.language)
    ) {
      setError("请填写有效的目标域名、关键词、国家 / 地区和语言。");
      return null;
    }
    return parsed.data;
  }

  function runSettings() {
    return settingsForRun(window.localStorage, (keys) =>
      client.serpApi.checkKeys({ keys }),
    );
  }

  async function runCore(
    input: KeywordRankingInput,
    plan: {
      fetchKeywords: string[];
      failures: FailedKeyword[];
      keyIdByKeyword: Record<string, string>;
      previousResults: KeywordRankingResult[];
    },
  ) {
    setError(null);
    pauseRef.current = false;

    try {
      const settings = await runSettings();
      const eligibleKeyIds = new Set(
        settings.keys.filter(isEligible).map((key) => key.id),
      );
      const preferredKeyIdByKeyword = Object.fromEntries(
        plan.fetchKeywords.flatMap((keyword) => {
          const keyId = plan.keyIdByKeyword[keyword];
          return keyId && eligibleKeyIds.has(keyId) ? [[keyword, keyId]] : [];
        }),
      );
      const unboundKeywords = plan.fetchKeywords.filter(
        (keyword) => !preferredKeyIdByKeyword[keyword],
      );
      const initialBatches = planKeywordBatches({
        keyIdByKeyword: preferredKeyIdByKeyword,
        keywords: plan.fetchKeywords,
        unboundKeyIds: selectBatchKeys(
          settings,
          Math.ceil(unboundKeywords.length / 5),
        ),
      });
      if (initialBatches.length === 0) {
        throw new Error("没有可用于本次查询的 SerpAPI Key。");
      }

      let afterInitial: KeywordRankingWorkspaceState = {
        ...createWorkspace(input),
        keyIdByKeyword: plan.keyIdByKeyword,
        results: plan.previousResults,
        run: {
          config: {
            keyIds: settings.keys.map((key) => key.id),
            strategy: settings.strategy,
          },
          failures: plan.failures,
          phase: "initial" as const,
          status: "running" as const,
        },
      };
      persist(afterInitial);
      setForm(formFromInput(input));
      setPage(0);

      const initial = await runInitialBatches({
        batches: initialBatches,
        execute: (batchInput) => client.keywordRanking.runBatch(batchInput),
        input: { ...input, keywords: plan.fetchKeywords },
        keys: settings.keys,
        onBatchSettled: ({ failures, keyId, results }) => {
          afterInitial = {
            ...afterInitial,
            keyIdByKeyword: keyId
              ? bindSuccessfulKeywords(
                  afterInitial.keyIdByKeyword,
                  keyId,
                  results,
                )
              : afterInitial.keyIdByKeyword,
            results: mergeResults(afterInitial, results),
            run: {
              ...afterInitial.run,
              failures: [...afterInitial.run.failures, ...failures],
            },
            updatedAt: new Date().toISOString(),
          };
          persist(afterInitial);
        },
        paused: () => pauseRef.current,
      });
      afterInitial = {
        ...afterInitial,
        results: mergeResults(afterInitial, initial.results),
        run: {
          ...afterInitial.run,
          failures: afterInitial.run.failures,
          status: pauseRef.current ? ("paused" as const) : ("running" as const),
        },
        updatedAt: new Date().toISOString(),
      };
      persist(afterInitial);
      if (pauseRef.current) {
        return;
      }

      afterInitial = {
        ...afterInitial,
        run: { ...afterInitial.run, phase: "failed" as const },
      };
      persist(afterInitial);
      let afterFailed = afterInitial;
      const retried = await runFailedBatches({
        execute: (batchInput) => client.keywordRanking.runBatch(batchInput),
        failures: afterInitial.run.failures,
        input,
        keys: settings.keys,
        onBatchSettled: ({ failures, keyId, results }) => {
          afterFailed = {
            ...afterFailed,
            keyIdByKeyword: keyId
              ? bindSuccessfulKeywords(
                  afterFailed.keyIdByKeyword,
                  keyId,
                  results,
                )
              : afterFailed.keyIdByKeyword,
            results: mergeResults(afterFailed, results),
            run: {
              ...afterFailed.run,
              failures,
              phase: "failed",
              status: "running",
            },
            updatedAt: new Date().toISOString(),
          };
          persist(afterFailed);
        },
        paused: () => pauseRef.current,
      });
      persist({
        ...afterFailed,
        results: mergeResults(afterFailed, retried.results),
        run: {
          ...afterFailed.run,
          failures: retried.failures,
          phase: pauseRef.current ? "failed" : "idle",
          status: pauseRef.current ? "paused" : "complete",
        },
        updatedAt: new Date().toISOString(),
      });
    } catch (caught) {
      const current = workspaceRef.current;
      if (
        current &&
        current.run.status === "running" &&
        current.run.config === null
      ) {
        persist({
          ...current,
          run: { ...current.run, phase: "idle", status: "idle" },
          updatedAt: new Date().toISOString(),
        });
      }
      setError(caught instanceof Error ? caught.message : "查询无法开始。");
    }
  }

  async function beginRun(input: KeywordRankingInput) {
    const retained = pruneKeywordBindings(
      workspaceRef.current?.keyIdByKeyword ?? {},
      input.keywords,
    );
    pauseRef.current = false;
    persist({
      ...createWorkspace(input),
      keyIdByKeyword: retained,
      run: {
        config: null,
        failures: [],
        phase: "initial",
        status: "running",
      },
    });
    setForm(formFromInput(input));
    setPage(0);
    await runCore(input, {
      fetchKeywords: input.keywords,
      failures: [],
      keyIdByKeyword: retained,
      previousResults: [],
    });
  }

  function submitForm(event: React.SubmitEvent) {
    event.preventDefault();
    if (running) {
      return;
    }
    const input = parseForm();
    if (!input) {
      return;
    }
    void beginRun(input);
  }

  async function resume() {
    const current = workspaceRef.current;
    if (!current) {
      return;
    }
    const completed = new Set(current.results.map((result) => result.keyword));
    const missing = current.input.keywords.filter(
      (keyword) => !completed.has(keyword),
    );
    pauseRef.current = false;
    if (missing.length === 0) {
      if (current.run.failures.length === 0) {
        persist({
          ...current,
          run: { ...current.run, phase: "idle", status: "complete" },
        });
        return;
      }
      await retryFailures();
      return;
    }
    await runCore(current.input, {
      fetchKeywords: missing,
      failures: current.run.failures,
      keyIdByKeyword: current.keyIdByKeyword,
      previousResults: current.results,
    });
  }

  async function retryFailures(keyword?: string) {
    const current = workspaceRef.current;
    if (!current || current.run.failures.length === 0) {
      return;
    }
    const selectedFailures = keyword
      ? current.run.failures.filter((failure) => failure.keyword === keyword)
      : current.run.failures;
    if (selectedFailures.length === 0) {
      return;
    }
    pauseRef.current = false;
    setError(null);
    try {
      const settings = await runSettings();
      const retainedFailures = current.run.failures.filter(
        (failure) => !selectedFailures.includes(failure),
      );
      let afterRetry: KeywordRankingWorkspaceState = {
        ...current,
        run: { ...current.run, phase: "failed", status: "running" },
      };
      persist(afterRetry);
      const retried = await runFailedBatches({
        execute: (batchInput) => client.keywordRanking.runBatch(batchInput),
        failures: selectedFailures,
        input: current.input,
        keys: settings.keys,
        onBatchSettled: ({ failures, keyId, results }) => {
          afterRetry = {
            ...afterRetry,
            keyIdByKeyword: keyId
              ? bindSuccessfulKeywords(
                  afterRetry.keyIdByKeyword,
                  keyId,
                  results,
                )
              : afterRetry.keyIdByKeyword,
            results: mergeResults(afterRetry, results),
            run: {
              ...afterRetry.run,
              failures: [...retainedFailures, ...failures],
              phase: "failed",
              status: "running",
            },
            updatedAt: new Date().toISOString(),
          };
          persist(afterRetry);
        },
        paused: () => pauseRef.current,
      });
      persist({
        ...afterRetry,
        results: mergeResults(afterRetry, retried.results),
        run: {
          ...afterRetry.run,
          failures: [...retainedFailures, ...retried.failures],
          phase: pauseRef.current ? "failed" : "idle",
          status: pauseRef.current ? "paused" : "complete",
        },
        updatedAt: new Date().toISOString(),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "重试失败。");
    }
  }

  function downloadCsv() {
    const current = workspaceRef.current;
    if (!current) {
      return;
    }
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([workspaceCsv(current)], { type: "text/csv;charset=utf-8" }),
    );
    link.download = "keyword-ranking.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard className="relative overflow-hidden">
        <div className="mb-8 flex items-start justify-between">
          <h2 className="font-bold text-2xl tracking-tight">查询工作区</h2>
          <SerpApiSettingsSheet />
        </div>
        <form className="flex flex-col gap-6" onSubmit={submitForm}>
          <Field htmlFor="keyword-ranking-domain" label="目标域名">
            <Input
              aria-label="目标域名"
              className={toolInputClassName}
              id="keyword-ranking-domain"
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  targetDomain: event.target.value,
                }))
              }
              placeholder="example.com"
              value={form.targetDomain}
            />
          </Field>
          <Field htmlFor="keyword-ranking-keywords" label="关键词">
            <Textarea
              aria-label="关键词"
              className={toolTextareaClassName}
              id="keyword-ranking-keywords"
              onChange={(event) =>
                setForm((value) => ({ ...value, keywords: event.target.value }))
              }
              placeholder={"关键词 1\n关键词 2"}
              rows={6}
              value={form.keywords}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field htmlFor="keyword-ranking-country" label="国家 / 地区">
              <select
                aria-label="国家 / 地区"
                className={toolSelectClassName}
                id="keyword-ranking-country"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    country: event.target.value,
                  }))
                }
                value={form.country}
              >
                {SERPAPI_COUNTRIES.map((entry) => (
                  <option key={entry.country_code} value={entry.country_code}>
                    {entry.country_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field htmlFor="keyword-ranking-language" label="语言">
              <select
                aria-label="语言"
                className={toolSelectClassName}
                id="keyword-ranking-language"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    language: event.target.value,
                  }))
                }
                value={form.language}
              >
                {SERPAPI_LANGUAGES.map((entry) => (
                  <option key={entry.language_code} value={entry.language_code}>
                    {entry.language_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field htmlFor="keyword-ranking-depth" label="查询深度">
              <select
                aria-label="查询深度"
                className={toolSelectClassName}
                id="keyword-ranking-depth"
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    searchDepth: event.target.value as FormState["searchDepth"],
                  }))
                }
                value={form.searchDepth}
              >
                {[10, 20, 30, 40, 50].map((depth) => (
                  <option key={depth} value={depth}>
                    {depth}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
            <div className="flex-1 rounded-xl border bg-muted/50 p-4">
              <div className="mb-1">
                <Microlabel>Run Hint</Microlabel>
              </div>
              <p className="text-muted-foreground text-xs">
                只有在已经保存 Key 池后才允许执行查询。
              </p>
              <p className="mt-2 text-muted-foreground text-xs">
                预计 SerpAPI 请求次数：{estimatedAttempts}
              </p>
            </div>

            <div className="flex md:min-w-64">
              <Button
                className="h-14 w-full cursor-pointer gap-2 rounded-xl px-8 font-medium text-sm md:h-full"
                disabled={startDisabled}
                type="submit"
              >
                开始查询
                <ArrowUpRight className="size-4.5" />
              </Button>
            </div>
          </div>
        </form>
      </SectionCard>

      {error ? (
        <Banner role="alert" tone="error">
          {error}
        </Banner>
      ) : null}
      {unsaved ? (
        <Banner tone="warning">当前结果未保存，刷新页面会丢失进度。</Banner>
      ) : null}

      {summary ? (
        <dl className="grid grid-cols-3 gap-4">
          <MetricCard label="已找到" value={summary.found} />
          <MetricCard label="未找到" value={summary["not-found"]} />
          <MetricCard label="失败" value={summary.failed} />
        </dl>
      ) : null}

      {workspace ? (
        <SectionCard className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-2xl tracking-tight">查询结果</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                已完成 {resultCount(workspace)} /{" "}
                {workspace.input.keywords.length}
                {workspace.run.phase === "initial" ? " · 初始查询" : ""}
                {workspace.run.phase === "failed" ? " · 失败队列" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {running ? (
                <Button
                  className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
                  onClick={() => {
                    pauseRef.current = true;
                  }}
                  type="button"
                  variant="outline"
                >
                  <Pause />
                  暂停
                </Button>
              ) : null}
              {workspace.run.status === "paused" ? (
                <Button
                  className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
                  onClick={resume}
                  type="button"
                >
                  <Play />
                  继续查询
                </Button>
              ) : null}
              {workspace.run.failures.length > 0 && !running ? (
                <Button
                  className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
                  onClick={() => retryFailures()}
                  type="button"
                  variant="outline"
                >
                  <RefreshCw />
                  重试失败项
                </Button>
              ) : null}
              <Button
                className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
                disabled={workspace.results.length === 0}
                onClick={downloadCsv}
                type="button"
                variant="outline"
              >
                <Download />
                导出 CSV
              </Button>
            </div>
          </div>

          {workspace.input.keywords.length > 0 ? (
            <div
              aria-label="查询进度"
              aria-valuemax={workspace.input.keywords.length}
              aria-valuemin={0}
              aria-valuenow={resultCount(workspace)}
              aria-valuetext={`已完成 ${resultCount(workspace)} / ${workspace.input.keywords.length}`}
              className="h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (resultCount(workspace) /
                        workspace.input.keywords.length) *
                        100,
                    ),
                  )}%`,
                }}
              />
            </div>
          ) : null}

          {workspace.results.length === 0 ? (
            <p className="grid min-h-60 place-items-center rounded-2xl border border-dashed p-8 text-center text-muted-foreground text-sm">
              尚无结果。
            </p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full border-collapse text-left text-base">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <DataTableHead className="whitespace-nowrap">
                      关键词
                    </DataTableHead>
                    <DataTableHead className="whitespace-nowrap">
                      状态
                    </DataTableHead>
                    <DataTableHead className="whitespace-nowrap">
                      排名
                    </DataTableHead>
                    <DataTableHead className="whitespace-nowrap">
                      网址
                    </DataTableHead>
                    <th className="px-4 py-4">
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleResults.map((result) => (
                    <tr
                      className="transition-colors hover:bg-accent/30"
                      key={result.keyword}
                    >
                      <td className="px-4 py-4 font-medium">
                        {result.keyword}
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill
                          tone={
                            result.status === "found"
                              ? "success"
                              : result.status === "not-found"
                                ? "neutral"
                                : "error"
                          }
                        >
                          {result.status === "found"
                            ? "已找到"
                            : result.status === "not-found"
                              ? "未找到"
                              : "失败"}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        {result.rank ?? "—"}
                      </td>
                      <td className="max-w-50 truncate px-4 py-4 text-muted-foreground text-sm">
                        {result.url ?? result.errorCode ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        {result.status === "failed" ? (
                          <Button
                            aria-label={`重试 ${result.keyword}`}
                            className="rounded-lg"
                            disabled={running}
                            onClick={() => retryFailures(result.keyword)}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <RefreshCw />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {workspace.results.length > 0 ? (
            <Pagination
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPage(0);
                setPageSize(size);
              }}
              page={safePage}
              pageCount={pageCount}
              pageSize={pageSize}
            />
          ) : null}
        </SectionCard>
      ) : null}

      <AlertDialog onOpenChange={setStorageDialog} open={storageDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>无法保存当前工作区</AlertDialogTitle>
          <AlertDialogDescription>
            可以继续本次查询，或删除此前保存的工作区后重试保存。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button
                  className="h-10 cursor-pointer rounded-xl px-4 font-medium text-sm"
                  variant="outline"
                />
              }
            >
              继续但不保存
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 cursor-pointer rounded-xl px-4 font-medium text-sm"
              onClick={() => {
                const current = workspaceRef.current;
                if (!current) {
                  return;
                }
                void retrySaveWorkspace(
                  keywordRankingWorkspaceStorage,
                  current,
                ).then((result) => {
                  setUnsaved(!result.persisted);
                  setStorageDialog(false);
                });
              }}
              type="button"
            >
              删除此前工作区并重试
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
