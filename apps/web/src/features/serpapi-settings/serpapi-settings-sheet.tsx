"use client";

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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@toolora/ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@toolora/ui/components/sheet";
import { Textarea } from "@toolora/ui/components/textarea";
import { Settings } from "lucide-react";
import { useState } from "react";

import { client } from "@/utils/orpc";

import {
  applyAccountChecks,
  createEmptySettings,
  hasKeyHealth,
  keyPoolText,
  loadSettings,
  maskKey,
  normalizeKeyPool,
  resolveStorageFailure,
  SERP_API_SETTINGS_CHANGED_EVENT,
  type SerpApiSettings,
  saveSettings,
} from "./settings";

const STATUS_LABELS = {
  active: "可用",
  forbidden: "已禁止",
  invalid: "无效",
  "quota-exhausted": "额度已用尽",
  "rate-limited": "触及速率限制",
  unchecked: "未检测",
  unknown: "状态未知",
} as const;

const STATUS_STYLES = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  forbidden: "bg-red-500/10 text-red-600 dark:text-red-400",
  invalid: "bg-red-500/10 text-red-600 dark:text-red-400",
  "quota-exhausted": "bg-red-500/10 text-red-600 dark:text-red-400",
  "rate-limited": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  unchecked: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
} as const;

const settingsCardClass =
  "rounded-[2.5rem] bg-accent/30 [--card-spacing:--spacing(8)]";

export function SerpApiSettingsSheet() {
  const [open, setOpen] = useState(false);
  const [keyText, setKeyText] = useState("");
  const [settings, setSettings] = useState(createEmptySettings);
  const [hasSessionSettings, setHasSessionSettings] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const healthKeys = settings.keys.filter((key) => key.checkedAt !== null);

  function persist(next: SerpApiSettings) {
    setSettings(next);
    const result = saveSettings(window.localStorage, next);
    setUnsaved(!result.persisted);
    setShowRecovery(!result.persisted);
    window.dispatchEvent(new Event(SERP_API_SETTINGS_CHANGED_EVENT));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !hasSessionSettings) {
      const saved = loadSettings(window.localStorage);
      setSettings(saved);
      setKeyText(keyPoolText(saved.keys));
      setError(null);
      setUnsaved(false);
      setHasSessionSettings(true);
    }
    setOpen(nextOpen);
  }

  function saveKeys() {
    const keys = normalizeKeyPool(keyText, settings.keys, () =>
      crypto.randomUUID(),
    );
    persist({ ...settings, keys });
    setKeyText(keyPoolText(keys));
  }

  function setStrategy(strategy: SerpApiSettings["strategy"]) {
    persist({ ...settings, strategy });
  }

  async function checkKeys() {
    if (settings.keys.length === 0) {
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const response = await client.serpApi.checkKeys({
        keys: settings.keys.map(({ id, secret }) => ({ id, secret })),
      });
      persist({
        ...settings,
        keys: applyAccountChecks(settings.keys, response.results),
      });
    } catch {
      setError("无法检测 Key 状态，请稍后重试。");
    } finally {
      setChecking(false);
    }
  }

  function resolveRecovery(choice: "memory" | "retry") {
    const result = resolveStorageFailure(choice, window.localStorage, settings);
    setUnsaved(!result.persisted);
    setShowRecovery(false);
  }

  return (
    <>
      <Sheet onOpenChange={handleOpenChange} open={open}>
        <SheetTrigger
          render={<Button className="gap-2 rounded-lg" variant="outline" />}
        >
          <Settings data-icon="inline-start" />
          <span className="cursor-pointer text-sm">打开设置</span>
        </SheetTrigger>
        <SheetContent className="max-w-4xl bg-muted/30 p-8 sm:p-10">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 pb-10">
            <SheetHeader className="mb-0 pr-10">
              <SheetTitle>查询设置</SheetTitle>
            </SheetHeader>

            <Card className={settingsCardClass}>
              <CardHeader>
                <CardTitle>
                  <span className="mb-3 text-2xl tracking-tight">
                    Key 池管理
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Textarea
                  aria-label="新增 SerpAPI Key"
                  className="min-h-40 rounded-2xl bg-background/50 px-5 py-4 text-sm leading-relaxed"
                  onChange={(event) => setKeyText(event.target.value)}
                  placeholder="输入 SerpAPI Key，一行一个"
                  rows={5}
                  value={keyText}
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="h-12 flex-1 cursor-pointer rounded-xl font-bold text-sm"
                    onClick={saveKeys}
                    type="button"
                    variant="outline"
                  >
                    保存 Key
                  </Button>
                  <Button
                    className="h-12 flex-1 cursor-pointer rounded-xl font-bold text-sm"
                    disabled={checking || settings.keys.length === 0}
                    onClick={checkKeys}
                    type="button"
                  >
                    检测全部 Key
                  </Button>
                </div>
                {error ? (
                  <p className="text-destructive text-sm" role="alert">
                    {error}
                  </p>
                ) : null}
                {unsaved ? (
                  <p className="text-destructive text-sm" role="status">
                    当前设置仅在本次使用，刷新后会丢失。
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {hasKeyHealth(settings.keys) ? (
              <Card className={`${settingsCardClass} order-3`}>
                <CardHeader>
                  <CardTitle>
                    <span className="mb-3 text-2xl tracking-tight">
                      Key 健康状态
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {settings.keys.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      尚未保存任何 Key。
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border bg-card/50">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="border-b bg-muted/30 text-[10px] text-muted-foreground">
                          <tr>
                            <th className="px-4 py-4 font-medium tracking-widest">
                              Key
                            </th>
                            <th className="px-4 py-4 font-medium tracking-widest">
                              剩余次数
                            </th>
                            <th className="px-4 py-4 font-medium tracking-widest">
                              当月限额
                            </th>
                            <th className="px-4 py-4 font-medium tracking-widest">
                              套餐名称
                            </th>
                            <th className="px-4 py-4 font-medium tracking-widest">
                              小时用量
                            </th>
                            <th className="px-4 py-4 font-medium tracking-widest">
                              状态
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {healthKeys.map((key) => (
                            <tr
                              className="transition-colors hover:bg-accent/20"
                              key={key.id}
                            >
                              <td className="px-4 py-4 text-xs">
                                {maskKey(key.secret)}
                              </td>
                              <td className="px-4 py-4 text-xs">
                                {key.searchesLeft ?? "—"}
                              </td>
                              <td className="px-4 py-4 text-xs">
                                {key.monthlyLimit ?? "—"}
                              </td>
                              <td className="px-4 py-4 text-xs">
                                {key.planName ?? "—"}
                              </td>
                              <td className="px-4 py-4 text-xs">
                                {key.hourlyUsed ?? "—"}
                                {key.hourlyLimit === null
                                  ? ""
                                  : ` / ${key.hourlyLimit}`}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`rounded-full px-2 py-1 font-bold text-[10px] ${STATUS_STYLES[key.status]}`}
                                >
                                  {STATUS_LABELS[key.status]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            <Card className={`${settingsCardClass} order-2`}>
              <CardHeader>
                <CardTitle>
                  <span className="mb-3 text-2xl tracking-tight">查询策略</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">选择查询策略</legend>
                  <label className="flex cursor-pointer flex-col gap-1 rounded-2xl border p-5 has-[:checked]:border-2 has-[:checked]:border-foreground has-[:checked]:bg-background/50">
                    <input
                      checked={settings.strategy === "round-robin"}
                      name="serpapi-strategy"
                      onChange={() => setStrategy("round-robin")}
                      className="sr-only"
                      type="radio"
                      value="round-robin"
                    />
                    <span className="font-bold text-sm">轮询分发</span>
                    <span className="text-muted-foreground text-sm">
                      在可用 Key 间均匀分配初始批次。
                    </span>
                  </label>
                  <label className="flex cursor-pointer flex-col gap-1 rounded-2xl border p-5 has-[:checked]:border-2 has-[:checked]:border-foreground has-[:checked]:bg-background/50">
                    <input
                      checked={settings.strategy === "sequential"}
                      name="serpapi-strategy"
                      onChange={() => setStrategy("sequential")}
                      className="sr-only"
                      type="radio"
                      value="sequential"
                    />
                    <span className="font-bold text-sm">顺序优先</span>
                    <span className="text-muted-foreground text-sm">
                      按顺序查询，直到当前 Key 不可用。
                    </span>
                  </label>
                </fieldset>
              </CardContent>
            </Card>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog onOpenChange={setShowRecovery} open={showRecovery}>
        <AlertDialogContent>
          <AlertDialogTitle>无法保存 SerpAPI Settings</AlertDialogTitle>
          <AlertDialogDescription>
            可以继续仅本次使用，或仅删除此前保存的 SerpAPI Key 后重试。
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => resolveRecovery("memory")}
              render={
                <Button
                  className="h-10 cursor-pointer rounded-xl px-4 text-sm"
                  variant="outline"
                />
              }
            >
              仅本次使用，不保存
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 cursor-pointer rounded-xl px-4 text-sm"
              onClick={() => resolveRecovery("retry")}
              type="button"
            >
              删除此前保存的 SerpAPI Key 并重试
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
