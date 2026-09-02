import type { ReactNode } from "react";
import type { ToolManifestItem } from "@/lib/tools";

export function ToolPageShell({
  children,
  tool,
}: {
  children: ReactNode;
  tool: ToolManifestItem;
}) {
  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl px-6 py-8 sm:px-6 lg:px-6">
      <header className="mb-8 rounded-[2rem] border bg-card/50 p-8">
        <h1 className="mb-4 font-bold text-4xl tracking-tighter">
          {tool.name}
        </h1>
        <p className="max-w-3xl text-muted-foreground leading-relaxed">
          {tool.description}
        </p>
      </header>

      {children}
    </main>
  );
}
