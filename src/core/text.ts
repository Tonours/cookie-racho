export function stripDiacritics(input: string): string {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function toAsciiLower(input: string): string {
  return stripDiacritics(input)
    .replace(/[\u0152\u0153]/g, "oe")
    .replace(/[\u00c6\u00e6]/g, "ae")
    .toLowerCase();
}

export function tokenizeForMatching(input: string): string[] {
  const normalized = toAsciiLower(input).replace(/[^a-z0-9]+/g, " ").trim();
  return normalized ? normalized.split(/\s+/) : [];
}

export function includesKeyword(haystackTokens: string[], keyword: string): boolean {
  const needleTokens = tokenizeForMatching(keyword);
  if (needleTokens.length === 0) return false;

  if (needleTokens.length === 1) {
    const needle = needleTokens[0];
    return haystackTokens.some((t) => tokenMatches(t, needle));
  }

  if (containsSequence(haystackTokens, needleTokens)) return true;

  // Naive plural support for the last token (e.g. "pois chiche" vs "pois chiches").
  const last = needleTokens[needleTokens.length - 1];
  const pluralS = [...needleTokens.slice(0, -1), `${last}s`];
  if (containsSequence(haystackTokens, pluralS)) return true;
  const pluralX = [...needleTokens.slice(0, -1), `${last}x`];
  if (containsSequence(haystackTokens, pluralX)) return true;

  return false;
}

function tokenMatches(token: string, needle: string): boolean {
  if (token === needle) return true;
  if (token === `${needle}s` || token === `${needle}x`) return true;
  if (needle.endsWith("s") && token === needle.slice(0, -1)) return true;
  if (needle.endsWith("x") && token === needle.slice(0, -1)) return true;
  return false;
}

function containsSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return true;
  if (needle.length > haystack.length) return false;

  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (!tokenMatches(haystack[i + j], needle[j])) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return true;
    }
  }

  return false;
}
