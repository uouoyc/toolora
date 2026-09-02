export type MinimumSharedUrlPair = {
  keywordA: string;
  keywordB: string;
  sharedUrlCount: number;
  sharedUrls: string[];
};

export type DomainAnalysis = {
  matchUrls: string[];
  hasPossibleCannibalization: boolean;
};

export type KeywordCluster = {
  clusterId: string;
  primaryKeyword: string;
  clusterKeywords: string[];
  minimumSharedUrlPair: MinimumSharedUrlPair | null;
  domainAnalysis: DomainAnalysis | null;
};

export type ClusterRequest = {
  keywords: readonly string[];
  evidence: Readonly<Record<string, readonly string[]>>;
  groupingAccuracy: number;
  targetDomain: string | null;
};

function pairIndex(i: number, j: number) {
  return i > j ? (i * (i - 1)) / 2 + j : (j * (j - 1)) / 2 + i;
}

/** The host of a page identity (`host/path` — scheme, port, and www are gone). */
function identityHost(identity: string) {
  const slash = identity.indexOf("/");
  return slash === -1 ? identity : identity.slice(0, slash);
}

/**
 * Deterministic complete-link agglomerative clustering over SERP page
 * identities. Only Evidence Ready keywords participate; every rule and
 * invariant of the Keyword Clustering specification applies.
 */
export function clusterKeywords(request: ClusterRequest): KeywordCluster[] {
  const keywords = request.keywords.filter(
    (keyword) => (request.evidence[keyword] ?? []).length > 0,
  );
  const size = keywords.length;
  if (size === 0) {
    return [];
  }

  const evidenceLists = keywords.map((keyword) => [
    ...new Set(request.evidence[keyword] ?? []),
  ]);
  const keySets = evidenceLists.map((urls) => new Set(urls));

  // Every Pair's overlap count lives in a compact triangular Uint8Array;
  // Top 10 Evidence keeps the counts well inside a byte.
  const matrix = new Uint8Array((size * (size - 1)) / 2);
  for (let i = 1; i < size; i += 1) {
    const candidateSet = keySets[i];
    for (let j = 0; j < i; j += 1) {
      let count = 0;
      for (const url of evidenceLists[j] ?? []) {
        if (candidateSet?.has(url)) {
          count += 1;
        }
      }
      matrix[pairIndex(i, j)] = count;
    }
  }

  // Complete-link merging: each active cluster is keyed by its earliest
  // member's input index, so id order is deterministic input order.
  const members = new Map<number, number[]>(
    keywords.map((_, index) => [index, [index]]),
  );
  const mergedMins = new Map<number, number>();
  const pairKey = (a: number, b: number) =>
    Math.min(a, b) * size + Math.max(a, b);

  function crossMin(a: number, b: number) {
    const cached = mergedMins.get(pairKey(a, b));
    if (cached !== undefined) {
      return cached;
    }
    const left = members.get(a) ?? [];
    const right = members.get(b) ?? [];
    if (left.length === 1 && right.length === 1) {
      return matrix[pairIndex(left[0] ?? 0, right[0] ?? 0)] ?? 0;
    }
    let min = 255;
    for (const i of left) {
      for (const j of right) {
        min = Math.min(min, matrix[pairIndex(i, j)] ?? 0);
      }
    }
    return min;
  }

  // Candidates wait in a lazy max-heap: descending shared URL count, then
  // ascending cluster ids, which is the deterministic input-order tie-break.
  // Stale entries (merged-away or weakened clusters) are skipped on pop.
  type Candidate = { a: number; b: number; min: number };
  const heap: Candidate[] = [];
  const comesFirst = (left: Candidate, right: Candidate) =>
    left.min !== right.min
      ? left.min > right.min
      : left.a !== right.a
        ? left.a < right.a
        : left.b < right.b;

  function push(candidate: Candidate) {
    heap.push(candidate);
    let child = heap.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      const childEntry = heap[child];
      const parentEntry = heap[parent];
      if (childEntry && parentEntry && comesFirst(childEntry, parentEntry)) {
        heap[child] = parentEntry;
        heap[parent] = childEntry;
        child = parent;
      } else {
        break;
      }
    }
  }

  function pop() {
    const top = heap[0];
    const last = heap.pop();
    if (last && heap.length > 0) {
      heap[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = parent * 2 + 2;
        let best = parent;
        if (
          left < heap.length &&
          comesFirst(heap[left] ?? last, heap[best] ?? last)
        ) {
          best = left;
        }
        if (
          right < heap.length &&
          comesFirst(heap[right] ?? last, heap[best] ?? last)
        ) {
          best = right;
        }
        if (best === parent) {
          break;
        }
        const parentEntry = heap[parent];
        const bestEntry = heap[best];
        if (parentEntry && bestEntry) {
          heap[parent] = bestEntry;
          heap[best] = parentEntry;
        }
        parent = best;
      }
    }
    return top;
  }

  for (let i = 1; i < size; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const min = matrix[pairIndex(i, j)] ?? 0;
      if (min >= request.groupingAccuracy) {
        push({ a: j, b: i, min });
      }
    }
  }

  for (;;) {
    let best: Candidate | undefined;
    while (heap.length > 0) {
      const candidate = pop();
      if (
        candidate &&
        members.has(candidate.a) &&
        members.has(candidate.b) &&
        candidate.min === crossMin(candidate.a, candidate.b)
      ) {
        best = candidate;
        break;
      }
    }
    if (!best) {
      break;
    }

    for (const id of members.keys()) {
      if (id !== best.a && id !== best.b) {
        const merged = Math.min(crossMin(best.a, id), crossMin(best.b, id));
        mergedMins.set(pairKey(best.a, id), merged);
        if (merged >= request.groupingAccuracy) {
          push({
            a: Math.min(best.a, id),
            b: Math.max(best.a, id),
            min: merged,
          });
        }
      }
    }
    members.set(
      best.a,
      [...(members.get(best.a) ?? []), ...(members.get(best.b) ?? [])].sort(
        (left, right) => left - right,
      ),
    );
    members.delete(best.b);
  }

  function primaryOf(memberIndexes: number[]) {
    let best = memberIndexes[0] ?? 0;
    let bestTotal = -1;
    for (const candidate of memberIndexes) {
      let total = 0;
      for (const other of memberIndexes) {
        if (other !== candidate) {
          total += matrix[pairIndex(candidate, other)] ?? 0;
        }
      }
      if (total > bestTotal) {
        bestTotal = total;
        best = candidate;
      }
    }
    return best;
  }

  function minimumPairOf(memberIndexes: number[]) {
    let best: { a: number; b: number; count: number } | null = null;
    for (let p = 0; p < memberIndexes.length; p += 1) {
      for (let q = p + 1; q < memberIndexes.length; q += 1) {
        const a = memberIndexes[p] ?? 0;
        const b = memberIndexes[q] ?? 0;
        const count = matrix[pairIndex(a, b)] ?? 0;
        if (!best || count < best.count) {
          best = { a, b, count };
        }
      }
    }
    return best;
  }

  function domainAnalysisOf(memberIndexes: number[]) {
    if (request.targetDomain === null) {
      return null;
    }
    const seen = new Set<string>();
    const matchUrls: string[] = [];
    for (const memberIndex of memberIndexes) {
      for (const url of evidenceLists[memberIndex] ?? []) {
        if (identityHost(url) === request.targetDomain && !seen.has(url)) {
          seen.add(url);
          matchUrls.push(url);
        }
      }
    }
    return {
      matchUrls,
      hasPossibleCannibalization: matchUrls.length > 1,
    };
  }

  return [...members.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([_, memberIndexes], clusterIndex) => {
      const pair =
        memberIndexes.length > 1 ? minimumPairOf(memberIndexes) : null;
      return {
        clusterId: String(clusterIndex + 1),
        primaryKeyword: keywords[primaryOf(memberIndexes)] ?? "",
        clusterKeywords: memberIndexes.map(
          (memberIndex) => keywords[memberIndex] ?? "",
        ),
        minimumSharedUrlPair: pair
          ? {
              keywordA: keywords[pair.a] ?? "",
              keywordB: keywords[pair.b] ?? "",
              sharedUrlCount: pair.count,
              sharedUrls: (evidenceLists[pair.a] ?? []).filter((url) =>
                keySets[pair.b]?.has(url),
              ),
            }
          : null,
        domainAnalysis: domainAnalysisOf(memberIndexes),
      };
    });
}
