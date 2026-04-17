"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

const labels = {
  "zh-CN": { home: "返回首页", back: "返回上页" },
  en: { home: "Go Home", back: "Go Back" },
} as const;

export default function NotFound() {
  const router = useRouter();
  const locale = useLocale();
  const t = labels[locale as keyof typeof labels] ?? labels.en;

  return (
    <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-8">
        <h1 className="text-muted-foreground/20 text-[120px] leading-none font-bold select-none">
          404
        </h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => router.push("/")}>
          <Home size={16} />
          <span>{t.home}</span>
        </Button>

        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft size={16} />
          <span>{t.back}</span>
        </Button>
      </div>
    </div>
  );
}
