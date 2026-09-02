import { describe, expect, it } from "vitest";
import { csvCell, csvDocument } from "./csv";

describe("CSV export helpers", () => {
  it("quotes values and escapes embedded quotes", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(42)).toBe('"42"');
    expect(csvCell(null)).toBe('""');
  });

  it("neutralizes formula injections", () => {
    expect(csvCell("=cmd")).toBe('"\'=cmd"');
    expect(csvCell("+1")).toBe('"\'+1"');
    expect(csvCell("-1")).toBe('"\'-1"');
    expect(csvCell("@x")).toBe('"\'@x"');
  });

  it("builds a BOM document with CRLF lines", () => {
    expect(
      csvDocument([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toBe('\uFEFF"a","b"\r\n"1","2"');
  });
});
