import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";

const bytes = readdirSync("dist/assets")
  .filter((file) => file.endsWith(".js"))
  .reduce((total, file) => total + gzipSync(readFileSync(`dist/assets/${file}`)).byteLength, 0);

console.log(`Initial JS bundle (gzip): ${(bytes / 1024).toFixed(2)} KB (${bytes} bytes)`);
