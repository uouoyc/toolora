import { splitHighlightSegments } from "@/lib/tools";

export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  return splitHighlightSegments(text, query).map((segment, index) =>
    segment.match ? (
      <mark
        className="rounded-sm bg-yellow-200/80 px-0.5 text-inherit dark:bg-yellow-400/30"
        key={`${segment.text}-${index}`}
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
}
