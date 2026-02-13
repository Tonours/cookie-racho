export function decodeHtmlEntities(input: string): string {
  // Minimal decoding for attribute values and JSON-LD script type.
  // Handles numeric entities commonly seen on Marmiton (e.g. &#x2F; and &#47;).
  return input
    .replace(/&#x([0-9a-f]+);/giu, (m, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    })
    .replace(/&#(\d+);/gu, (m, dec) => {
      const n = Number.parseInt(dec, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    })
    .replace(/&quot;/giu, '"')
    .replace(/&apos;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&amp;/giu, "&");
}
