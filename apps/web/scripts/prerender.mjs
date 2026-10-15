// vite build で作った dist/index.html をひな形に、各ページの HTML を書き出す。
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const template = await readFile(`${root}/dist/index.html`, "utf8");
const { render } = await import(`${root}/dist-ssr/entry-server.js`);

const pages = [
  { page: "home", file: "index.html" },
  { page: "not-found", file: "404.html" },
];

for (const { page, file } of pages) {
  const html = template
    .replace("<!--app-->", render(page))
    .replace("<body>", `<body data-page="${page}">`);
  await writeFile(`${root}/dist/${file}`, html);
}

await rm(`${root}/dist-ssr`, { recursive: true, force: true });
console.log(`prerendered ${pages.length} pages`);
