"use client";

import { useRouter } from "next/navigation";

import { ArrowLeft, Home } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  const router = useRouter();

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
          <span>Go Home</span>
        </Button>

        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft size={16} />
          <span>Go Back</span>
        </Button>
      </div>
    </div>
  );
}
