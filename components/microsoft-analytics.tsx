"use client";

import { useEffect } from "react";

import Clarity from "@microsoft/clarity";

export function MicrosoftAnalytics({ gaId }: { gaId: string }) {
  useEffect(() => {
    Clarity.init(gaId);
  }, [gaId]);

  return null;
}
