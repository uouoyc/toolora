import { Button } from "@toolora/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@toolora/ui/components/card";
import { Settings2 } from "lucide-react";

import type { ToolManifestItem } from "@/lib/tools";

export function ToolPageShell({ tool }: { tool: ToolManifestItem }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-4 sm:px-6 lg:px-6">
      <header className="mb-8 rounded-[2rem] border bg-card/50 p-8">
        <h1 className="mb-4 font-bold text-4xl tracking-tighter">
          {tool.name}
        </h1>
        <p className="max-w-3xl text-muted-foreground leading-relaxed">
          {tool.description}
        </p>
      </header>

      <Card className="gap-0 rounded-[2rem] p-8">
        <CardHeader className="mb-8 flex flex-row items-start justify-between px-0">
          <CardTitle className="font-bold text-2xl tracking-tight">
            工作区
          </CardTitle>
          <Button
            className="cursor-pointer gap-2 rounded-xl text-sm"
            variant="outline"
          >
            <Settings2 data-icon="inline-start" />
            打开设置
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed text-muted-foreground text-sm">
            该工具将在后续阶段接入业务工作流。
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
