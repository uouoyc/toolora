"use client";

import {
  type KeywordClusteringInput,
  KeywordClusteringInputSchema,
} from "@toolora/api/contracts/keyword-clustering";
import { normalizeKeywords } from "@toolora/api/contracts/keywords";
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
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/banner";
import {
  Field,
  toolInputClassName,
  toolSelectClassName,
  toolTextareaClassName,
} from "@/components/field";
import { MetricCard } from "@/components/metric-card";
import { Microlabel } from "@/components/microlabel";
import { SectionCard } from "@/components/section-card";
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
import type { KeywordCluster } from "./cluster";
import { clusterKeywords } from "./cluster";
import { runClustering } from "./cluster-client";
import { ClusterResults } from "./cluster-results";
import {
  planKeywordBatches,
  runFailedBatches,
  runInitialBatches,
} from "./runner";
import {
  keywordClusteringWorkspaceStorage,
  loadWorkspace,
  retrySaveWorkspace,
  saveWorkspace,
} from "./storage";
import {
  bindSuccessfulKeywords,
  buildKeywordStatuses,
  clusterCsv,
  clusterRequestFrom,
  createWorkspace,
  type FailedKeyword,
  type KeywordClusteringWorkspace as KeywordClusteringWorkspaceState,
  keywordDetailCsv,
  mergeEvidence,
  pruneKeywordBindings,
  summarizeEvidence,
  withoutKeyword,
} from "./workspace";

type FormState = {
  country: string;
  groupingAccuracy: string;
  keywords: string;
  language: string;
  targetDomain: string;
};

const EMPTY_FORM: FormState = {
  country: "us",
  groupingAccuracy: "3",
  keywords: "",
  language: "en",
  targetDomain: "",
};

function formFromInput(input: KeywordClusteringInput): FormState {
  return {
    country: input.country,
    groupingAccuracy: String(input.groupingAccuracy),
    keywords: input.keywords.join("\n"),
    language: input.language,
    targetDomain: input.targetDomain ?? "",
  };
}

export function KeywordClusteringWorkspace() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [workspace, setWorkspace] =
    useState<KeywordClusteringWorkspaceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageDialog, setStorageDialog] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [clusters, setClusters] = useState<KeywordCluster[] | null>(null);
  const [clustering, setClustering] = useState(false);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [deleteDialogKeyword, setDeleteDialogKeyword] = useState<string | null>(
    null,
  );
  const workspaceRef = useRef<KeywordClusteringWorkspaceState | null>(null);
  const pauseRef = useRef(false);

  function persist(next: KeywordClusteringWorkspaceState) {
    workspaceRef.current = next;
    setWorkspace(next);
    void saveWorkspace(keywordClusteringWorkspaceStorage, next).then(
      (result) => {
        if (!result.persisted) {
          setUnsaved(true);
          setStorageDialog(true);
        }
      },
    );
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
        void saveWorkspace(keywordClusteringWorkspaceStorage, saved);
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

  // The deterministic clustering re-runs locally whenever Evidence, Grouping
  // Accuracy, or Target Domain settle — never while a Run is in progress.
  useEffect(() => {
    if (!workspace || workspace.run.status === "running") {
      return;
    }
    const request = clusterRequestFrom(workspace);
    if (request.keywords.length === 0) {
      setClusters([]);
      return;
    }
    let active = true;
    setClustering(true);
    runClustering(request)
      .then((result) => {
        if (active) {
          setClusters(result);
          setClusterError(null);
        }
      })
      .catch((caught) => {
        if (active) {
          setClusterError(
            caught instanceof Error ? caught.message : "聚类失败。",
          );
        }
      })
      .finally(() => {
        if (active) {
          setClustering(false);
        }
      });
    return () => {
      active = false;
    };
  }, [workspace]);

  const evidenceSummary = workspace
    ? summarizeEvidence(workspace.evidence)
    : null;
  const coveredKeywords =
    clusters?.reduce(
      (total, cluster) => total + cluster.clusterKeywords.length,
      0,
    ) ?? 0;
  const keywordStatuses = buildKeywordStatuses(
    workspace?.input.keywords ?? [],
    workspace?.evidence ?? [],
    clusters ?? [],
  );
  const rawUrlByIdentity = (() => {
    const map: Record<string, string> = {};
    for (const result of workspace?.evidence ?? []) {
      for (const entry of result.urls) {
        map[entry.urlIdentity] ??= entry.url;
      }
    }
    return map;
  })();
  const keywordCount = normalizeKeywords(form.keywords.split(/\r?\n/)).length;
  const formIncomplete =
    keywordCount === 0 ||
    !isSerpApiCountry(form.country) ||
    !isSerpApiLanguage(form.language);
  const running = workspace?.run.status === "running";
  const startDisabled = formIncomplete || !hasKeys || running;

  function parseForm() {
    const parsed = KeywordClusteringInputSchema.safeParse({
      country: form.country,
      groupingAccuracy: Number(form.groupingAccuracy),
      keywords: form.keywords.split(/\r?\n/),
      language: form.language,
      targetDomain: form.targetDomain.trim() || null,
    });
    if (
      !parsed.success ||
      !isSerpApiCountry(form.country) ||
      !isSerpApiLanguage(form.language)
    ) {
      setError("请填写有效的关键词、国家 / 地区、语言和可选的目标域名。");
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
    input: KeywordClusteringInput,
    plan: {
      fetchKeywords: string[];
      failures: FailedKeyword[];
      keyIdByKeyword: Record<string, string>;
      previousEvidence: KeywordClusteringWorkspaceState["evidence"];
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

      let afterInitial: KeywordClusteringWorkspaceState = {
        ...createWorkspace(input),
        evidence: plan.previousEvidence,
        keyIdByKeyword: plan.keyIdByKeyword,
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

      const initial = await runInitialBatches({
        batches: initialBatches,
        execute: (batchInput) =>
          client.keywordClustering.fetchBatch(batchInput),
        input: {
          country: input.country,
          keywords: plan.fetchKeywords,
          language: input.language,
        },
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
            evidence: mergeEvidence(afterInitial, results).evidence,
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
        evidence: mergeEvidence(afterInitial, initial.results).evidence,
        run: {
          ...afterInitial.run,
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
        execute: (batchInput) =>
          client.keywordClustering.fetchBatch(batchInput),
        failures: afterInitial.run.failures,
        input: {
          country: input.country,
          keywords: input.keywords,
          language: input.language,
        },
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
            evidence: mergeEvidence(afterFailed, results).evidence,
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
        evidence: mergeEvidence(afterFailed, retried.results).evidence,
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

  async function beginRun(input: KeywordClusteringInput) {
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
    await runCore(input, {
      fetchKeywords: input.keywords,
      failures: [],
      keyIdByKeyword: retained,
      previousEvidence: [],
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
    const fetched = new Set(current.evidence.map((result) => result.keyword));
    const missing = current.input.keywords.filter(
      (keyword) => !fetched.has(keyword),
    );
    pauseRef.current = false;
    if (missing.length === 0) {
      if (current.run.failures.length === 0) {
        persist({
          ...current,
          run: { ...current.run, phase: "idle", status: "complete" },
          updatedAt: new Date().toISOString(),
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
      previousEvidence: current.evidence,
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
      let afterRetry: KeywordClusteringWorkspaceState = {
        ...current,
        run: { ...current.run, phase: "failed", status: "running" },
      };
      persist(afterRetry);
      const retried = await runFailedBatches({
        execute: (batchInput) =>
          client.keywordClustering.fetchBatch(batchInput),
        failures: selectedFailures,
        input: {
          country: current.input.country,
          keywords: current.input.keywords,
          language: current.input.language,
        },
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
            evidence: mergeEvidence(afterRetry, results).evidence,
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
        evidence: mergeEvidence(afterRetry, retried.results).evidence,
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

  function requestDeleteKeyword(keyword: string) {
    if (!workspaceRef.current || running) {
      return;
    }
    setDeleteDialogKeyword(keyword);
  }

  function deleteKeyword() {
    const current = workspaceRef.current;
    const keyword = deleteDialogKeyword;
    setDeleteDialogKeyword(null);
    if (!current || !keyword || running) {
      return;
    }
    const next = withoutKeyword(current, keyword);
    persist(next);
    setForm(formFromInput(next.input));
  }

  function applyGroupingAccuracy(value: string) {
    setForm((previous) => ({ ...previous, groupingAccuracy: value }));
    const current = workspaceRef.current;
    if (!current || current.run.status === "running") {
      return;
    }
    persist({
      ...current,
      input: { ...current.input, groupingAccuracy: Number(value) },
      updatedAt: new Date().toISOString(),
    });
  }

  function applyTargetDomain() {
    const current = workspaceRef.current;
    if (!current || current.run.status === "running") {
      return;
    }
    const candidate = form.targetDomain.trim();
    if (candidate === (current.input.targetDomain ?? "")) {
      return;
    }
    if (!candidate) {
      persist({
        ...current,
        input: { ...current.input, targetDomain: null },
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    const parsed = KeywordClusteringInputSchema.safeParse({
      country: current.input.country,
      groupingAccuracy: current.input.groupingAccuracy,
      keywords: current.input.keywords,
      language: current.input.language,
      targetDomain: candidate,
    });
    if (!parsed.success) {
      setError("目标域名无效：请输入主机名或 HTTP(S) 网址。");
      return;
    }
    setError(null);
    persist({
      ...current,
      input: parsed.data,
      updatedAt: new Date().toISOString(),
    });
  }

  function downloadCsv(
    buildDocument: (
      workspace: KeywordClusteringWorkspaceState,
      clusters: KeywordCluster[],
    ) => string,
    filename: string,
  ) {
    const current = workspaceRef.current;
    if (!current) {
      return;
    }
    const link = document.createElement("a");
    // Clusters are recomputed synchronously from the persisted Workspace so a
    // just-changed Accuracy or Target Domain can never leak a stale export.
    link.href = URL.createObjectURL(
      new Blob(
        [buildDocument(current, clusterKeywords(clusterRequestFrom(current)))],
        {
          type: "text/csv;charset=utf-8",
        },
      ),
    );
    link.download = filename;
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
          <Field htmlFor="keyword-clustering-keywords" label="关键词">
            <Textarea
              aria-label="关键词"
              className={toolTextareaClassName}
              id="keyword-clustering-keywords"
              onChange={(event) =>
                setForm((value) => ({ ...value, keywords: event.target.value }))
              }
              placeholder={"关键词 1\n关键词 2"}
              rows={6}
              value={form.keywords}
            />
          </Field>
          <Field htmlFor="keyword-clustering-domain" label="目标域名（可选）">
            <Input
              aria-label="目标域名"
              className={toolInputClassName}
              id="keyword-clustering-domain"
              onBlur={applyTargetDomain}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field htmlFor="keyword-clustering-country" label="国家 / 地区">
              <select
                aria-label="国家 / 地区"
                className={toolSelectClassName}
                id="keyword-clustering-country"
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
            <Field htmlFor="keyword-clustering-language" label="语言">
              <select
                aria-label="语言"
                className={toolSelectClassName}
                id="keyword-clustering-language"
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
            <Field htmlFor="keyword-clustering-accuracy" label="聚类精度">
              <select
                aria-label="聚类精度"
                className={toolSelectClassName}
                id="keyword-clustering-accuracy"
                onChange={(event) => applyGroupingAccuracy(event.target.value)}
                value={form.groupingAccuracy}
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map(
                  (accuracy) => (
                    <option key={accuracy} value={accuracy}>
                      {accuracy}
                    </option>
                  ),
                )}
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
                预计 SerpAPI 请求次数：{keywordCount}
              </p>
            </div>
            <div className="flex md:min-w-64">
              <Button
                className="h-14 w-full cursor-pointer gap-2 rounded-xl px-8 font-medium text-sm md:h-full"
                disabled={startDisabled}
                type="submit"
              >
                开始分析
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

      {evidenceSummary ? (
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Cluster 数" value={clusters?.length ?? "—"} />
          <MetricCard label="已覆盖关键词" value={coveredKeywords} />
          <MetricCard label="无证据" value={evidenceSummary["no-evidence"]} />
          <MetricCard label="失败" value={evidenceSummary.failed} />
        </dl>
      ) : null}

      {workspace ? (
        <ClusterResults
          clusterError={clusterError}
          clusters={clusters}
          clustering={clustering}
          evidence={Object.fromEntries(
            workspace.evidence
              .filter((result) => result.status === "evidence-ready")
              .map((result) => [result.keyword, result.urls]),
          )}
          rawUrlByIdentity={rawUrlByIdentity}
          evidenceDone={workspace.evidence.length}
          evidenceTotal={workspace.input.keywords.length}
          failures={workspace.run.failures}
          input={workspace.input}
          keywordStatuses={keywordStatuses}
          onDeleteKeyword={requestDeleteKeyword}
          onExportClusterCsv={() =>
            downloadCsv(clusterCsv, "keyword-clustering-clusters.csv")
          }
          onExportKeywordCsv={() =>
            downloadCsv(keywordDetailCsv, "keyword-clustering-keywords.csv")
          }
          onPause={() => {
            pauseRef.current = true;
          }}
          onResume={resume}
          onRetryFailures={() => void retryFailures()}
          onRetryKeyword={(keyword) => void retryFailures(keyword)}
          runPhase={workspace.run.phase}
          runStatus={workspace.run.status}
        />
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
                  keywordClusteringWorkspaceStorage,
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

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogKeyword(null);
          }
        }}
        open={deleteDialogKeyword !== null}
      >
        <AlertDialogContent>
          <AlertDialogTitle>删除关键词</AlertDialogTitle>
          <AlertDialogDescription>
            删除该关键词后，其搜索结果证据也会被删除，并基于剩余关键词重新聚类。
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
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 cursor-pointer rounded-xl px-4 font-medium text-sm"
              onClick={deleteKeyword}
              type="button"
            >
              删除关键词
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
