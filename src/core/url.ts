export function normalizeUrlSpec(spec: string): string {
  const raw = spec.trim();
  if (!raw) throw new Error("URL is required");

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }

  url.hash = "";
  return url.toString();
}

export function getUrlHost(spec: string): string {
  const url = new URL(normalizeUrlSpec(spec));
  return url.hostname.toLowerCase();
}
