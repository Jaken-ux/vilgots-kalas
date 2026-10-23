import { defineConfig, type Plugin } from "vite";
import { content, staticText, staticHref } from "./src/content";
import { spritePaths, spriteSize } from "./src/sprites";

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Fyller i fasta texter/länkar från src/content.ts direkt i index.html, så att
// sidan går att läsa även om JS inte körs. Bryter bygget om ett element saknas.
function prerenderContent(): Plugin {
  return {
    name: "prerender-content",
    transformIndexHtml(html) {
      for (const [id, text] of Object.entries(staticText())) {
        const re = new RegExp(`(<([a-z0-9]+)\\b[^>]*\\bid="${id}"[^>]*>)(</\\2>)`);
        if (!re.test(html)) throw new Error(`prerender-content: hittar inget tomt element med id="${id}"`);
        html = html.replace(re, (_m, open: string, _tag: string, close: string) => open + esc(text) + close);
      }
      for (const [id, href] of Object.entries(staticHref())) {
        const re = new RegExp(`(\\bid="${id}"[^>]*?\\bhref=)"#"`);
        if (!re.test(html)) throw new Error(`prerender-content: hittar ingen länk med id="${id}" href="#"`);
        html = html.replace(re, `$1"${esc(href)}"`);
      }
      const subject = /(<input\b[^>]*\bid="form-subject")/;
      if (!subject.test(html)) throw new Error('prerender-content: hittar inte id="form-subject"');
      return html.replace(subject, `$1 value="${esc(content.rsvp.subject)}"`);
    },
  };
}

// Ritar pixelgrafiken (src/sprites.ts) i varje tom <svg data-sprite="namn"></svg>,
// så att den finns i HTML:en från start och syns även utan JS.
function prerenderSprites(): Plugin {
  return {
    name: "prerender-sprites",
    transformIndexHtml(html) {
      return html.replace(/<svg\b([^>]*\bdata-sprite="([\w-]+)"[^>]*)><\/svg>/g, (_m, attrs: string, name: string) => {
        const [w, h] = spriteSize(name); // kastar vid okänt namn
        return `<svg${attrs} viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${spritePaths(name)}</svg>`;
      });
    },
  };
}

export default defineConfig({
  base: "/vilgots-kalas/",
  plugins: [prerenderContent(), prerenderSprites()],
  build: {
    assetsInlineLimit: 0,
    // Brett stöd: syntax sänks till ES2019 (bl.a. ?. och ??), CSS till Chrome 79/Safari 13
    target: ["es2019", "chrome79", "safari13", "firefox78", "edge79"],
    cssTarget: ["chrome79", "safari13"],
  },
  publicDir: "public",
});
