import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Header } from "@/components/header";
import { routing } from "@/i18n/routing";
import { getMessage, loadMessages, resolveLocale } from "@/lib/i18n";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);
  const messages = await loadMessages(locale);

  const siteName = getMessage(messages, "app.title");

  return {
    title: {
      template: `%s - ${siteName}`,
      default: siteName,
    },
    description: getMessage(messages, "app.description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main className="bg-background text-foreground selection:bg-primary selection:text-primary-foreground flex min-h-screen w-full flex-col font-sans">
        <Header />
        {children}
      </main>
    </NextIntlClientProvider>
  );
}
