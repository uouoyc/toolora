import type { Metadata } from "next";

import { ToolPageShell } from "@/components/tool-page-shell";
import { KeywordRankingWorkspace } from "@/features/keyword-ranking/keyword-ranking-workspace";
import { TOOLS } from "@/lib/tools";

const tool = TOOLS.find(({ slug }) => slug === "keyword-ranking");

export const metadata: Metadata = {
  title: tool?.name,
  description: tool?.description,
};

export default function KeywordRankingPage() {
  return tool ? (
    <ToolPageShell tool={tool}>
      <KeywordRankingWorkspace />
    </ToolPageShell>
  ) : null;
}
