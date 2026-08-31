import type { Metadata } from "next";

import { ToolPageShell } from "@/components/tool-page-shell";
import { TOOLS } from "@/lib/tools";

const tool = TOOLS.find(({ slug }) => slug === "keyword-ranking");

export const metadata: Metadata = {
  title: tool?.name,
  description: tool?.description,
};

export default function KeywordRankingPage() {
  return tool ? <ToolPageShell tool={tool} /> : null;
}
