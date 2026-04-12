"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface KeyHealthRow {
  alias: string;
  remaining: number;
  total: number;
  plan: string;
  rateUsed: number;
  rateLimit: number;
  status: "active" | "rate_limited" | "exhausted";
}

interface RankerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  strategy: "roundRobin" | "sequential";
  onStrategyChange: (s: "roundRobin" | "sequential") => void;
  keys: string[];
  onKeysChange: (keys: string[]) => void;
}

// Persist keys to localStorage
const STORAGE_KEY = "toolora-kr-keys";

function saveKeys(keys: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function RankerSettings({
  isOpen,
  onClose,
  onOpen,
  strategy,
  onStrategyChange,
  keys,
  onKeysChange,
}: RankerSettingsProps) {
  const t = useTranslations("keywordRanking");
  const [keysText, setKeysText] = useState(keys.join("\n"));
  const [telemetry, setTelemetry] = useState<KeyHealthRow[]>([]);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [visible, setVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Sync keysText when keys prop changes from outside
  useEffect(() => {
    setKeysText(keys.join("\n"));
  }, [keys]);

  // Animate in when opened, and call onOpen so parent can refresh key health
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
      onOpen?.();
    } else {
      setVisible(false);
    }
  }, [isOpen, onOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  if (!isOpen && !visible) return null;

  const handleSave = () => {
    const parsed = keysText
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);
    onKeysChange(parsed);
    saveKeys(parsed);
  };

  const handleCheckQuota = async () => {
    if (keys.length === 0) return;
    setIsLoadingHealth(true);
    try {
      const res = await fetch("/api/keyword-ranking/key-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (res.ok) {
        const data: KeyHealthRow[] = await res.json();
        setTelemetry(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingHealth(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`bg-background/80 fixed inset-0 z-50 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`bg-card border-border fixed top-0 right-0 z-50 h-full w-full max-w-4xl overflow-y-auto border-l p-8 transition-transform duration-200 ease-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mx-auto max-w-3xl space-y-12 pb-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight">
              {t("settings.title")}
            </h3>
            <button
              onClick={handleBackdropClick}
              className="border-input hover:bg-accent flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Key Pool */}
          <section className="border-border bg-accent/30 space-y-6 rounded-[2.5rem] border p-8">
            <div>
              <p className="text-muted-foreground mb-2 ml-1 font-mono text-[10px] tracking-widest uppercase">
                {t("settings.keyPool.label")}
              </p>
              <h4 className="mb-3 text-2xl font-bold tracking-tight">
                {t("settings.keyPool.title")}
              </h4>
              <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                {t("settings.keyPool.description")}
              </p>
            </div>

            <div className="space-y-3">
              <textarea
                value={keysText}
                onChange={(e) => setKeysText(e.target.value)}
                rows={6}
                placeholder={t("settings.keyPool.placeholder")}
                className="border-border bg-background/50 focus:border-primary focus:ring-primary/10 w-full rounded-2xl border px-5 py-4 font-mono text-sm leading-relaxed transition-all outline-none focus:ring-4"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSave}
                className="flex-1 cursor-pointer rounded-xl py-4 text-xs font-bold tracking-widest uppercase"
              >
                {t("settings.keyPool.save")}
              </Button>
              <Button
                onClick={handleCheckQuota}
                disabled={keys.length === 0 || isLoadingHealth}
                className="shadow-primary/20 flex-1 cursor-pointer rounded-xl py-4 text-xs font-bold tracking-widest uppercase shadow-lg"
              >
                {isLoadingHealth ? "..." : t("settings.keyPool.check")}
              </Button>
            </div>
          </section>

          {/* Strategy */}
          <section className="border-border bg-accent/30 space-y-6 rounded-[2.5rem] border p-8">
            <div>
              <p className="text-muted-foreground mb-2 ml-1 font-mono text-[10px] tracking-widest uppercase">
                {t("settings.strategy.label")}
              </p>
              <h4 className="mb-3 text-2xl font-bold tracking-tight">
                {t("settings.strategy.title")}
              </h4>
              <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                {t("settings.strategy.description")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => onStrategyChange("roundRobin")}
                className={`cursor-pointer rounded-2xl p-5 text-left transition-all ${
                  strategy === "roundRobin"
                    ? "border-primary bg-primary/5 border-2 shadow-sm"
                    : "border-border hover:border-primary/50 border"
                }`}
              >
                <p className="text-sm font-bold">
                  {t("settings.strategy.roundRobin")}
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  {t("settings.strategy.roundRobinDesc")}
                </p>
              </button>

              <button
                onClick={() => onStrategyChange("sequential")}
                className={`cursor-pointer rounded-2xl p-5 text-left transition-all ${
                  strategy === "sequential"
                    ? "border-primary bg-primary/5 border-2 shadow-sm"
                    : "border-border hover:border-primary/50 border"
                }`}
              >
                <p className="text-sm font-bold">
                  {t("settings.strategy.sequential")}
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  {t("settings.strategy.sequentialDesc")}
                </p>
              </button>
            </div>
          </section>

          {/* Key Health */}
          {telemetry.length > 0 && (
            <section className="border-border bg-accent/30 space-y-6 rounded-[2.5rem] border p-8">
              <div>
                <p className="text-muted-foreground mb-2 ml-1 font-mono text-[10px] tracking-widest uppercase">
                  {t("settings.health.label")}
                </p>
                <h4 className="mb-3 text-2xl font-bold tracking-tight">
                  {t("settings.health.title")}
                </h4>
                <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
                  {t("settings.health.description")}
                </p>
              </div>

              <div className="border-border bg-card/50 overflow-x-auto rounded-2xl border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-border bg-muted/30 border-b">
                      <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                        {t("settings.health.key")}
                      </th>
                      <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                        {t("settings.health.remaining")}
                      </th>
                      <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                        {t("settings.health.total")}
                      </th>
                      <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                        {t("settings.health.plan")}
                      </th>
                      <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                        {t("settings.health.rateUsed")}
                      </th>
                      <th className="text-muted-foreground px-4 py-4 font-mono text-[10px] tracking-widest uppercase">
                        {t("settings.health.status")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {telemetry.map((row) => (
                      <tr
                        key={row.alias}
                        className="hover:bg-accent/20 transition-colors"
                      >
                        <td className="px-4 py-4 font-mono text-xs">
                          {row.alias}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {row.remaining.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {row.total.toLocaleString()}
                        </td>
                        <td className="text-muted-foreground px-4 py-4 text-xs">
                          {row.plan}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {row.rateUsed} / {row.rateLimit}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${
                              row.status === "active"
                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                : row.status === "rate_limited"
                                  ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                            }`}
                          >
                            {row.status === "active"
                              ? t("settings.health.active")
                              : row.status === "rate_limited"
                                ? t("settings.health.rateLimited")
                                : t("settings.health.exhausted")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
