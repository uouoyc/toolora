import { getRequestConfig } from "next-intl/server";

import { loadMessages, resolveLocale } from "@/lib/i18n";

export default getRequestConfig(async ({ locale, requestLocale }) => {
  const resolvedLocale = resolveLocale(locale ?? (await requestLocale));

  return {
    locale: resolvedLocale,
    messages: await loadMessages(resolvedLocale),
  };
});
