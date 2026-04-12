import { NextResponse } from "next/server";

import {
  type KeyHealthRow,
  deriveKeyStatus,
  maskKey,
} from "@/lib/keyword-ranking";

interface AccountApiResponse {
  plan_searches_left: number;
  searches_per_month: number;
  plan_name: string;
  last_hour_searches: number;
  account_rate_limit_per_hour: number;
}

export async function POST(request: Request) {
  try {
    const { keys }: { keys: string[] } = await request.json();

    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: "keys is required" }, { status: 400 });
    }

    // Fetch SerpAPI Account API for each key in parallel
    const results = await Promise.all(
      keys.map(async (key): Promise<KeyHealthRow> => {
        const alias = maskKey(key);

        try {
          const res = await fetch(
            `https://serpapi.com/account?api_key=${encodeURIComponent(key)}`,
          );

          if (!res.ok) {
            return {
              alias,
              remaining: 0,
              total: 0,
              plan: "Unknown",
              rateUsed: 0,
              rateLimit: 0,
              status: "exhausted",
            };
          }

          const data: AccountApiResponse = await res.json();

          return {
            alias,
            remaining: data.plan_searches_left,
            total: data.searches_per_month,
            plan: data.plan_name,
            rateUsed: data.last_hour_searches,
            rateLimit: data.account_rate_limit_per_hour,
            status: deriveKeyStatus(
              data.plan_searches_left,
              data.last_hour_searches,
              data.account_rate_limit_per_hour,
            ),
          };
        } catch {
          return {
            alias,
            remaining: 0,
            total: 0,
            plan: "Unknown",
            rateUsed: 0,
            rateLimit: 0,
            status: "exhausted",
          };
        }
      }),
    );

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
