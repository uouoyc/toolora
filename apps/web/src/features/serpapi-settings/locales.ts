import countriesSnapshot from "./data/serpapi-countries.json";
import languagesSnapshot from "./data/serpapi-languages.json";

export type SerpApiCountry = {
  country_code: string;
  country_name: string;
};

export type SerpApiLanguage = {
  language_code: string;
  language_name: string;
};

export const SERPAPI_COUNTRIES: readonly SerpApiCountry[] = countriesSnapshot;
export const SERPAPI_LANGUAGES: readonly SerpApiLanguage[] = languagesSnapshot;

const countryCodes = new Set(SERPAPI_COUNTRIES.map((e) => e.country_code));
const languageCodes = new Set(SERPAPI_LANGUAGES.map((e) => e.language_code));

export function isSerpApiCountry(code: string) {
  return countryCodes.has(code);
}

export function isSerpApiLanguage(code: string) {
  return languageCodes.has(code);
}
