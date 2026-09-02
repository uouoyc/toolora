"use client";

import type { SerpEvidenceUrl } from "@toolora/api/contracts/keyword-clustering";
import { Button } from "@toolora/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@toolora/ui/components/dropdown-menu";
import { Input } from "@toolora/ui/components/input";
import { ChevronDown, Download, Pause, Play, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Banner } from "@/components/banner";
import { DataTableHead } from "@/components/data-table-head";
import { Microlabel } from "@/components/microlabel";
import { Pagination } from "@/components/pagination";
import { SectionCard } from "@/components/section-card";
import { StatusPill } from "@/components/status-pill";
import type { KeywordCluster } from "./cluster";
import type {
  FailedKeyword,
  KeywordRowStatus,
  RunPhase,
  RunStatus,
} from "./workspace";

const CANNIBALIZATION_HINT =
  "目标网站中发现多个页面与该关键词簇相关，可能存在关键词蚕食。此提示仅供排查，并非确诊。";
const weakestPairHint = (count: number) =>
  `该关键词簇中关联最弱的一对关键词，其 Google 搜索结果仍有 ${count} 个 URL 重合。`;
const evidenceCountHint = (count: number) =>
  `已成功获取该关键词 Top 10 搜索结果中的 ${count} 条。`;

function DeleteKeywordButton({
  disabled,
  keyword,
  onDeleteKeyword,
}: {
  disabled: boolean;
  keyword: string;
  onDeleteKeyword: (keyword: string) => void;
}) {
  return (
    <Button
      aria-label={`删除 ${keyword}`}
      className="rounded-lg"
      disabled={disabled}
      onClick={() => onDeleteKeyword(keyword)}
      size="icon-xs"
      type="button"
      variant="ghost"
    >
      <X />
    </Button>
  );
}

function memberSummary(keywords: readonly string[]) {
  const visible = keywords.slice(0, 3).join(" · ");
  const rest = keywords.length - 3;
  return rest > 0 ? `${visible} +${rest}` : visible;
}

/** Identity list; each entry links to its raw SERP URL when one is known. */
function UrlList({
  rawUrlByIdentity,
  urls,
}: {
  rawUrlByIdentity: Readonly<Record<string, string>>;
  urls: readonly string[];
}) {
  return (
    <ol className="space-y-1">
      {urls.map((identity, index) => {
        const rawUrl = rawUrlByIdentity[identity];
        return (
          <li
            className="break-all text-muted-foreground text-xs"
            key={identity}
          >
            {index + 1}.{" "}
            {rawUrl ? (
              <a
                className="underline decoration-dotted underline-offset-2"
                href={rawUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {identity}
              </a>
            ) : (
              identity
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MemberKeyword({
  evidenceUrls,
  isPrimary,
  keyword,
  onDeleteKeyword,
  running,
}: {
  evidenceUrls: readonly SerpEvidenceUrl[] | undefined;
  isPrimary: boolean;
  keyword: string;
  onDeleteKeyword: (keyword: string) => void;
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasEvidence = (evidenceUrls?.length ?? 0) > 0;
  return (
    <div className="transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm">
            {keyword}
            {isPrimary ? (
              <span className="ml-2 text-muted-foreground text-xs">
                主关键词
              </span>
            ) : null}
          </span>
          {hasEvidence ? (
            <button
              aria-expanded={open}
              className="flex cursor-pointer items-center gap-1"
              onClick={() => setOpen((value) => !value)}
              title={evidenceCountHint(evidenceUrls?.length ?? 0)}
              type="button"
            >
              <Microlabel>搜索结果 {evidenceUrls?.length}/10</Microlabel>
              <ChevronDown
                className={`size-3 shrink-0 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>
          ) : null}
        </span>
        <DeleteKeywordButton
          disabled={running}
          keyword={keyword}
          onDeleteKeyword={onDeleteKeyword}
        />
      </div>
      {open && hasEvidence ? (
        <ol className="space-y-1 px-4 pb-3">
          {(evidenceUrls ?? []).map((entry, index) => (
            <li
              className="break-all text-muted-foreground text-xs"
              key={entry.urlIdentity}
            >
              {index + 1}.{" "}
              <a
                className="underline decoration-dotted underline-offset-2"
                href={entry.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {entry.urlIdentity}
              </a>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function ClusterCard({
  cluster,
  evidence,
  onDeleteKeyword,
  rawUrlByIdentity,
  running,
}: {
  cluster: KeywordCluster;
  evidence: Readonly<Record<string, readonly SerpEvidenceUrl[]>>;
  onDeleteKeyword: (keyword: string) => void;
  rawUrlByIdentity: Readonly<Record<string, string>>;
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pair = cluster.minimumSharedUrlPair;
  const domain = cluster.domainAnalysis;

  return (
    <div
      className={`rounded-2xl border-2 bg-card/50 ${
        open ? "border-primary shadow-sm" : "border-border"
      }`}
    >
      <button
        aria-controls={`cluster-${cluster.clusterId}-detail`}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-base">
            {cluster.primaryKeyword}
          </span>
          <Microlabel>
            Cluster {cluster.clusterId} · {cluster.clusterKeywords.length} 词
          </Microlabel>
          {domain?.hasPossibleCannibalization ? (
            <StatusPill tone="warning">可能页面竞争</StatusPill>
          ) : null}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="border-t" id={`cluster-${cluster.clusterId}-detail`}>
          <ul className="divide-y">
            {cluster.clusterKeywords.map((keyword) => (
              <li key={keyword}>
                <MemberKeyword
                  evidenceUrls={evidence[keyword]}
                  isPrimary={keyword === cluster.primaryKeyword}
                  keyword={keyword}
                  onDeleteKeyword={onDeleteKeyword}
                  running={running}
                />
              </li>
            ))}
          </ul>
          {pair ? (
            <div
              className="space-y-2 border-t px-4 py-3"
              title={weakestPairHint(pair.sharedUrlCount)}
            >
              <Microlabel>最低 SERP 重合</Microlabel>
              <p className="text-sm">
                {pair.keywordA} ↔ {pair.keywordB}（重合 {pair.sharedUrlCount} 个
                URL）
              </p>
              <UrlList
                rawUrlByIdentity={rawUrlByIdentity}
                urls={pair.sharedUrls}
              />
            </div>
          ) : null}
          {domain ? (
            <div className="flex flex-col gap-1 border-t px-4 py-3">
              <Microlabel>目标网站匹配</Microlabel>
              {domain.matchUrls.length > 0 ? (
                <UrlList
                  rawUrlByIdentity={rawUrlByIdentity}
                  urls={domain.matchUrls}
                />
              ) : (
                <p className="text-muted-foreground text-sm">无匹配 URL</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ClusterRow({
  cluster,
  colSpan,
  evidence,
  hasTarget,
  onDeleteKeyword,
  running,
}: {
  cluster: KeywordCluster;
  colSpan: number;
  evidence: Readonly<Record<string, readonly SerpEvidenceUrl[]>>;
  hasTarget: boolean;
  onDeleteKeyword: (keyword: string) => void;
  running: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pair = cluster.minimumSharedUrlPair;
  const domain = cluster.domainAnalysis;

  return (
    <>
      <tr className="transition-colors hover:bg-accent/30">
        <td className="px-4 py-4 tabular-nums">{cluster.clusterId}</td>
        <td className="px-4 py-4 font-medium">{cluster.primaryKeyword}</td>
        <td className="max-w-72 truncate px-4 py-4 text-muted-foreground text-sm">
          {memberSummary(cluster.clusterKeywords)}
        </td>
        <td className="px-4 py-4 tabular-nums">
          {cluster.clusterKeywords.length}
        </td>
        <td
          className="px-4 py-4 tabular-nums"
          title={pair ? `${pair.keywordA} ↔ ${pair.keywordB}` : undefined}
        >
          {pair?.sharedUrlCount ?? "—"}
        </td>
        {hasTarget ? (
          <td className="px-4 py-4 text-sm">
            {domain && domain.matchUrls.length > 0 ? (
              <span
                title={
                  domain.hasPossibleCannibalization
                    ? CANNIBALIZATION_HINT
                    : undefined
                }
              >
                {domain.matchUrls.length}
                {domain.hasPossibleCannibalization ? (
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                    ⚠ 可能页面竞争
                  </span>
                ) : null}
              </span>
            ) : (
              "0"
            )}
          </td>
        ) : null}
        <td className="px-4 py-4">
          <span className="text-muted-foreground text-sm">
            {cluster.clusterKeywords.length === 1 ? "独立" : "成簇"}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-4 text-right">
          <Button
            aria-controls={`table-cluster-${cluster.clusterId}-detail`}
            aria-expanded={open}
            aria-label={`展开 Cluster ${cluster.clusterId}`}
            className="rounded-lg"
            onClick={() => setOpen((value) => !value)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <ChevronDown
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </Button>
        </td>
      </tr>
      {open ? (
        <tr id={`table-cluster-${cluster.clusterId}-detail`}>
          <td colSpan={colSpan} className="px-4 py-2">
            <div className="divide-y rounded-2xl border bg-card/50">
              {cluster.clusterKeywords.map((keyword) => (
                <MemberKeyword
                  evidenceUrls={evidence[keyword]}
                  isPrimary={keyword === cluster.primaryKeyword}
                  key={keyword}
                  keyword={keyword}
                  onDeleteKeyword={onDeleteKeyword}
                  running={running}
                />
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function ClusterResults({
  clusters,
  clustering,
  clusterError,
  evidence,
  evidenceDone,
  rawUrlByIdentity,
  evidenceTotal,
  failures,
  input,
  keywordStatuses,
  onDeleteKeyword,
  onExportClusterCsv,
  onExportKeywordCsv,
  onPause,
  onResume,
  onRetryFailures,
  onRetryKeyword,
  runPhase,
  runStatus,
}: {
  clusters: readonly KeywordCluster[] | null;
  clustering: boolean;
  clusterError: string | null;
  evidence: Readonly<Record<string, readonly SerpEvidenceUrl[]>>;
  evidenceDone: number;
  rawUrlByIdentity: Readonly<Record<string, string>>;
  evidenceTotal: number;
  failures: readonly FailedKeyword[];
  input: {
    groupingAccuracy: number;
    keywords: readonly string[];
    targetDomain: string | null;
  };
  keywordStatuses: Readonly<Record<string, KeywordRowStatus>>;
  onDeleteKeyword: (keyword: string) => void;
  onExportClusterCsv: () => void;
  onExportKeywordCsv: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetryFailures: () => void;
  onRetryKeyword: (keyword: string) => void;
  runPhase: RunPhase;
  runStatus: RunStatus;
}) {
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const query = filter.trim().toLowerCase();
  const running = runStatus === "running";
  const paused = runStatus === "paused";
  const visibleClusters = (clusters ?? []).filter((cluster) =>
    query
      ? cluster.clusterKeywords.some((keyword) => keyword.includes(query))
      : true,
  );
  const keywordMatches = (keyword: string) => !query || keyword.includes(query);
  const noEvidenceKeywords = input.keywords.filter(
    (keyword) =>
      keywordMatches(keyword) && keywordStatuses[keyword] === "no_evidence",
  );
  const visibleFailures = failures.filter((failure) =>
    keywordMatches(failure.keyword),
  );
  const pageCount = Math.max(1, Math.ceil(visibleClusters.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visiblePageClusters = visibleClusters.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize,
  );

  return (
    <SectionCard className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-2xl tracking-tight">聚类结果</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            已获取 {evidenceDone} / {evidenceTotal} 个关键词的搜索结果
            {runPhase === "initial" ? " · 初始查询" : ""}
            {runPhase === "failed" ? " · 失败队列" : ""}
            {clustering ? " · 正在聚类" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {running ? (
            <Button
              className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
              onClick={onPause}
              type="button"
              variant="outline"
            >
              <Pause />
              暂停
            </Button>
          ) : null}
          {paused ? (
            <Button
              className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
              onClick={onResume}
              type="button"
            >
              <Play />
              继续查询
            </Button>
          ) : null}
          {failures.length > 0 && !running ? (
            <Button
              className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
              onClick={onRetryFailures}
              type="button"
              variant="outline"
            >
              <RefreshCw />
              重试失败项
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  className="cursor-pointer gap-2 rounded-lg font-medium text-sm"
                  disabled={evidenceDone === 0}
                  type="button"
                  variant="outline"
                />
              }
            >
              <Download />
              导出 CSV
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-lg">
              <DropdownMenuItem onClick={onExportClusterCsv}>
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-medium text-sm">
                    聚类结果 CSV
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportKeywordCsv}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">关键词明细 CSV</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {clusterError ? (
        <Banner role="alert" tone="error">
          聚类失败：{clusterError}
        </Banner>
      ) : null}

      {evidenceTotal > 0 ? (
        <div
          aria-label="搜索结果获取进度"
          aria-valuemax={evidenceTotal}
          aria-valuemin={0}
          aria-valuenow={evidenceDone}
          aria-valuetext={`已获取 ${evidenceDone} / ${evidenceTotal}`}
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{
              width: `${Math.min(
                100,
                Math.round((evidenceDone / evidenceTotal) * 100),
              )}%`,
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Input
          aria-label="筛选关键词"
          className="h-10 w-full rounded-xl bg-background/50 text-sm md:w-72 md:text-sm"
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
          }}
          placeholder="筛选关键词或聚类成员"
          value={filter}
        />
        <div className="flex items-center gap-2">
          {(["cards", "table"] as const).map((mode) => (
            <button
              aria-pressed={view === mode}
              className={`h-9 cursor-pointer rounded-lg px-4 font-bold text-xs transition-all ${
                view === mode
                  ? "bg-primary text-primary-foreground"
                  : "border border-input bg-background hover:bg-accent"
              }`}
              key={mode}
              onClick={() => {
                setView(mode);
                setPage(0);
              }}
              type="button"
            >
              {mode === "cards" ? "卡片视图" : "表格视图"}
            </button>
          ))}
        </div>
      </div>

      {evidenceDone === 0 && clusters === null ? (
        <p className="grid min-h-60 place-items-center rounded-2xl border border-dashed p-8 text-center text-muted-foreground text-sm">
          尚无结果。
        </p>
      ) : view === "cards" ? (
        visibleClusters.length > 0 ? (
          <div className="flex flex-col gap-4">
            {visiblePageClusters.map((cluster) => (
              <ClusterCard
                cluster={cluster}
                evidence={evidence}
                key={cluster.clusterId}
                onDeleteKeyword={onDeleteKeyword}
                rawUrlByIdentity={rawUrlByIdentity}
                running={running}
              />
            ))}
            <Pagination
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              page={safePage}
              pageCount={pageCount}
              pageSize={pageSize}
            />
          </div>
        ) : (
          <p className="grid min-h-60 place-items-center rounded-2xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            没有匹配的聚类。
          </p>
        )
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-left text-base">
            <thead className="border-b text-muted-foreground">
              <tr>
                <DataTableHead className="whitespace-nowrap">
                  Cluster
                </DataTableHead>
                <DataTableHead className="whitespace-nowrap">
                  主关键词
                </DataTableHead>
                <DataTableHead className="whitespace-nowrap">
                  关键词成员
                </DataTableHead>
                <DataTableHead className="whitespace-nowrap">
                  关键词数
                </DataTableHead>
                <DataTableHead className="whitespace-nowrap">
                  最低 SERP 重合
                </DataTableHead>
                {input.targetDomain !== null ? (
                  <DataTableHead className="whitespace-nowrap">
                    目标网站匹配
                  </DataTableHead>
                ) : null}
                <DataTableHead className="whitespace-nowrap">
                  聚类状态
                </DataTableHead>
                <th className="px-4 py-4">
                  <span className="sr-only">操作</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visiblePageClusters.map((cluster) => (
                <ClusterRow
                  cluster={cluster}
                  colSpan={input.targetDomain !== null ? 8 : 7}
                  evidence={evidence}
                  hasTarget={input.targetDomain !== null}
                  key={cluster.clusterId}
                  onDeleteKeyword={onDeleteKeyword}
                  running={running}
                />
              ))}
            </tbody>
          </table>
          {visibleClusters.length > 0 ? (
            <Pagination
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(0);
              }}
              page={safePage}
              pageCount={pageCount}
              pageSize={pageSize}
            />
          ) : null}
        </div>
      )}

      {noEvidenceKeywords.length > 0 ? (
        <div className="space-y-3">
          <Microlabel>无证据（成功请求但无有效 URL，不参与聚类）</Microlabel>
          <ul className="divide-y rounded-2xl border bg-card/50">
            {noEvidenceKeywords.map((keyword) => (
              <li
                className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-accent/30"
                key={keyword}
              >
                <span className="flex items-center gap-3 text-sm">
                  {keyword}
                  <StatusPill tone="neutral">无证据</StatusPill>
                </span>
                <DeleteKeywordButton
                  disabled={running}
                  keyword={keyword}
                  onDeleteKeyword={onDeleteKeyword}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {failures.length > 0 ? (
        <div className="space-y-3">
          <Microlabel>失败（重试后仍未获取搜索结果）</Microlabel>
          <ul className="divide-y rounded-2xl border bg-card/50">
            {visibleFailures.map((failure) => (
              <li
                className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-accent/30"
                key={failure.keyword}
              >
                <span className="flex items-center gap-3 text-sm">
                  {failure.keyword}
                  <StatusPill tone="error">失败</StatusPill>
                  <span className="text-muted-foreground text-xs">
                    {failure.errorCode}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Button
                    aria-label={`重试 ${failure.keyword}`}
                    className="rounded-lg"
                    disabled={running}
                    onClick={() => onRetryKeyword(failure.keyword)}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <RefreshCw />
                  </Button>
                  <DeleteKeywordButton
                    disabled={running}
                    keyword={failure.keyword}
                    onDeleteKeyword={onDeleteKeyword}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}
