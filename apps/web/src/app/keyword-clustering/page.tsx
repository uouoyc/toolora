import type { Metadata } from "next";

import { ToolPageShell } from "@/components/tool-page-shell";
import { KeywordClusteringWorkspace } from "@/features/keyword-clustering/keyword-clustering-workspace";
import { TOOLS } from "@/lib/tools";

const tool = TOOLS.find(({ slug }) => slug === "keyword-clustering");

export const metadata: Metadata = {
  title: tool?.name,
  description: tool?.description,
};

export default function KeywordClusteringPage() {
  return tool ? (
    <ToolPageShell tool={tool}>
      <KeywordClusteringWorkspace />
    </ToolPageShell>
  ) : null;
}
