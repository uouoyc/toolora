import { notFound } from "next/navigation";

import { getMessage, loadMessages, resolveLocale } from "@/lib/i18n";

export default async function LocaleHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);

  if (locale !== localeParam) {
    notFound();
  }

  const messages = await loadMessages(locale);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {getMessage(messages, "home.title")}
        </h1>
      </div>
    </main>
  );
}
