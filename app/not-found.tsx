import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-muted-foreground/20 text-[120px] leading-none font-bold select-none">
        404
      </h1>
      <div className="mt-8 flex gap-3">
        <Link
          href="/"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center rounded-md px-4 py-2 text-sm font-medium"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
