import { useTranslations } from "next-intl";

interface RankerStatusProps {
  status: "idle" | "success" | "partial";
  found: number;
  total: number;
  failed: number;
  error: string | null;
}

export function RankerStatus({
  status,
  found,
  total,
  failed,
  error,
}: RankerStatusProps) {
  const t = useTranslations("keywordRanking");

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-600 dark:text-red-400">
        <span className="mr-2 font-mono font-bold">STATUS / ERROR</span>
        {error}
      </div>
    );
  }

  if (status === "idle") return null;

  const isSuccess = status === "success";

  return (
    <div
      className={`rounded-2xl p-4 text-sm font-medium ${
        isSuccess
          ? "border border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
          : "border border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
      }`}
    >
      <span className="mr-2 font-mono font-bold">
        STATUS / {status.toUpperCase()}
      </span>
      {isSuccess
        ? t("status.success", { found, total })
        : t("status.partial", { found, failed })}
    </div>
  );
}
