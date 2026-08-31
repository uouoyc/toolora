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
        className="rounded-sm bg-primary/10 px-0.5 text-inherit dark:bg-primary/20"
        key={`${segment.text}-${index}`}
      >
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
}
