import { decodeHtmlEntities } from "./htmlEntities";

const LINK_TAG_RE = /<link\b[^>]*>/gi;
const META_TAG_RE = /<meta\b[^>]*>/gi;
const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title>/i;

export function extractCanonicalUrl(html: string): string | null {
  for (const match of html.matchAll(LINK_TAG_RE)) {
    const tag = match[0] ?? "";
    const rel = getAttr(tag, "rel");
    if (!rel || rel.toLowerCase() !== "canonical") continue;
    const href = getAttr(tag, "href");
    if (href) return decodeHtmlEntities(href);
  }

  // Fallback: OpenGraph URL
  for (const match of html.matchAll(META_TAG_RE)) {
    const tag = match[0] ?? "";
    const prop = getAttr(tag, "property") ?? getAttr(tag, "name");
    if (!prop || prop.toLowerCase() !== "og:url") continue;
    const content = getAttr(tag, "content");
    if (content) return decodeHtmlEntities(content);
  }

  return null;
}

export function extractHtmlTitle(html: string): string | null {
  const match = html.match(TITLE_RE);
  const raw = match?.[1];
  const title = raw?.trim();
  return title ? title : null;
}

function getAttr(tag: string, name: string): string | null {
  const re = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i"
  );
  const match = tag.match(re);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}
