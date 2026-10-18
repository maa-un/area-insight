// vite build で作った dist/index.html をひな形に、各ページの HTML と sitemap.xml を書き出す。
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const template = await readFile(`${root}/dist/index.html`, "utf8");
const { render, pages } = await import(`${root}/dist-ssr/entry-server.js`);

// 公開する URL のオリジン。sitemap と canonical に使う。
const origin = process.env.SITE_ORIGIN ?? "https://machinome.maa-un.com";

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
// </script> で埋め込みが閉じないよう、JSON の < を逃がす。
const embedJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

const list = pages();
for (const { route, file, path, head } of list) {
  const headTags = [
    `<title>${escapeHtml(head.title)}</title>`,
    head.description && `<meta name="description" content="${escapeHtml(head.description)}" />`,
    head.noindex && `<meta name="robots" content="noindex" />`,
    path && `<link rel="canonical" href="${origin}${path}" />`,
  ]
    .filter(Boolean)
    .join("\n    ");
  const html = template
    .replace(/<title>.*?<\/title>\s*<meta name="description"[^>]*>/s, headTags)
    .replace("<!--app-->", render(route))
    .replace(
      "<!--route-->",
      `<script type="application/json" id="route">${embedJson(route)}</script>`,
    );
  await mkdir(dirname(`${root}/dist/${file}`), { recursive: true });
  await writeFile(`${root}/dist/${file}`, html);
}

const urls = list.flatMap(({ path, head }) =>
  path && !head.noindex ? [`  <url><loc>${origin}${path}</loc></url>`] : [],
);
await writeFile(
  `${root}/dist/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
);

await rm(`${root}/dist-ssr`, { recursive: true, force: true });
console.log(`prerendered ${list.length} pages`);
