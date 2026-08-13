// scripts/ 는 Node에서 직접 실행되는데 @types/node 가 없다.
// 의존성 추가는 승인 사항이므로(AGENTS.md 6), 여기서 쓰는 것만 최소로 선언한다.
//
// 나중에 @types/node 를 승인받아 추가하면 이 파일을 지운다. 중복 선언이 된다.

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:path" {
  export function join(...parts: string[]): string;
}

declare module "node:url" {
  export function pathToFileURL(path: string): URL;
}

declare const process: {
  argv: string[];
  exit(code: number): never;
};
