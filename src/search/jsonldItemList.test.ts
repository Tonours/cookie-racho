import { describe, expect, test } from "bun:test";

import { extractItemListResultsFromHtml } from "./jsonldItemList";

describe("extractItemListResultsFromHtml", () => {
  test("extracts ItemList ListItem results", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "item": { "@id": "/recettes/pates", "name": "Pates" }
              },
              {
                "@type": "ListItem",
                "position": 2,
                "url": "https://example.com/recettes/tomates",
                "name": "Tomates"
              }
            ]
          }</script>
        </head>
      </html>`;

    expect(
      extractItemListResultsFromHtml(html, {
        baseUrl: "https://example.com/search?q=x",
        allowedHostSuffixes: ["example.com"]
      })
    ).toEqual([
      { url: "https://example.com/recettes/pates", name: "Pates" },
      { url: "https://example.com/recettes/tomates", name: "Tomates" }
    ]);
  });

  test("extracts ItemList when itemListElement is a string array", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": [
              "/a",
              "https://example.com/b"
            ]
          }</script>
        </head>
      </html>`;

    expect(
      extractItemListResultsFromHtml(html, {
        baseUrl: "https://example.com/search?q=x"
      })
    ).toEqual([{ url: "https://example.com/a" }, { url: "https://example.com/b" }]);
  });

  test("extracts url from item.url and skips invalid URLs", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": [
              {"@type":"ListItem","item":{"url":"/recettes/a","name":"A"}},
              "http://"
            ]
          }</script>
        </head>
      </html>`;

    expect(
      extractItemListResultsFromHtml(html, {
        baseUrl: "https://example.com/search"
      })
    ).toEqual([{ url: "https://example.com/recettes/a", name: "A" }]);
  });

  test("finds ItemList inside @graph", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org",
            "@graph": [
              {"@type":"WebPage","name":"X"},
              {"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@id":"/x","name":"X"}}]}
            ]
          }</script>
        </head>
      </html>`;

    expect(
      extractItemListResultsFromHtml(html, {
        baseUrl: "https://example.com/search"
      })
    ).toEqual([{ url: "https://example.com/x", name: "X" }]);
  });

  test("supports ItemList @type arrays", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org",
            "@type": ["Thing", "ItemList"],
            "itemListElement": [
              {"@type":"ListItem","item":{"@id":"/x","name":"X"}}
            ]
          }</script>
        </head>
      </html>`;

    expect(
      extractItemListResultsFromHtml(html, {
        baseUrl: "https://example.com/search"
      })
    ).toEqual([{ url: "https://example.com/x", name: "X" }]);
  });

  test("skips list items when item has no URL", () => {
    const html = `<!doctype html>
      <html>
        <head>
          <script type="application/ld+json">{
            "@context": "https://schema.org",
            "@type": "ItemList",
            "itemListElement": [
              {"@type":"ListItem","item":{"name":"NoUrl"}}
            ]
          }</script>
        </head>
      </html>`;

    expect(
      extractItemListResultsFromHtml(html, {
        baseUrl: "https://example.com/search"
      })
    ).toEqual([]);
  });

  test("returns empty array when none exists", () => {
    expect(
      extractItemListResultsFromHtml("<html></html>", {
        baseUrl: "https://example.com/"
      })
    ).toEqual([]);
  });
});
