"use client";

import { useLocale } from "next-intl";

import { Globe } from "lucide-react";

import { usePathname, useRouter } from "@/i18n/navigation";

import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";

export function Header() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="border-border flex items-center justify-between px-4 py-6 sm:px-6 lg:px-0">
      <button
        onClick={() => router.replace("/", { locale })}
        className="flex cursor-pointer items-center gap-3"
      >
        <h1 className="text-2xl font-bold tracking-tighter">Toolora</h1>
      </button>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => {
            const nextLocale = locale === "zh-CN" ? "en" : "zh-CN";
            router.replace(pathname, { locale: nextLocale });
          }}
          className="cursor-pointer"
        >
          <Globe size={14} />
          <span>{locale === "zh-CN" ? "EN" : "中文"}</span>
        </Button>

        <ThemeToggle />
      </div>
    </header>
  );
}
