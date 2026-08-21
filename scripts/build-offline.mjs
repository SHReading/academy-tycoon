// dist/index.html 의 외부 JS·CSS 를 인라인해 dist/offline.html 을 만든다.
//
// 왜 필요한가: 04 문서 5절이 "시연은 반드시 오프라인에서도 돌아가야 한다"고 요구하는데,
// 빌드 산출물은 <script type="module" src="..."> 라서 file:// 로 열면 CORS 로 막힌다.
// 인라인 모듈 스크립트는 네트워크 요청이 없으므로 더블클릭만으로 실행된다.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const dist = join(dirname(new URL(import.meta.url).pathname), "..", "dist");
const read = (href) => readFileSync(join(dist, href.replace(/^\.\//, "")), "utf8");

// 인라인 후 </script> 나 </style> 가 태그를 조기 종료하는 것을 막는다
const safe = (code, tag) => code.replaceAll(`</${tag}`, `<\\/${tag}`);

let html = readFileSync(join(dist, "index.html"), "utf8");

html = html.replace(
  /<script[^>]*src="([^"]+)"[^>]*><\/script>/,
  (_all, src) => `<script type="module">\n${safe(read(src), "script")}\n</script>`,
);
html = html.replace(
  /<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/,
  (_all, href) => `<style>\n${safe(read(href), "style")}\n</style>`,
);

const leftover = html.match(/(?:src|href)="(?!data:)[^"]+"/g);
if (leftover) throw new Error(`외부 참조가 남았다: ${leftover.join(", ")}`);

writeFileSync(join(dist, "offline.html"), html);
console.log(`offline.html ${(Buffer.byteLength(html) / 1024).toFixed(1)}KB — 외부 참조 0`);
