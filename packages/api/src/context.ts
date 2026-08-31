import type {
  SerpApiCheckKeysInput,
  SerpApiCheckKeysOutput,
} from "./contracts/serpapi";

export type SerpApiClient = {
  checkKeys: (
    keys: SerpApiCheckKeysInput["keys"],
  ) => Promise<SerpApiCheckKeysOutput>;
};

export function createContext({ serpApi }: { serpApi: SerpApiClient }) {
  return { serpApi };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
