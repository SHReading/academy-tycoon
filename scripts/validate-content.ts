// 콘텐츠 검증기 — 06_REPO_SETUP.md 3절 규격
//
// 검사 4종과 실패 시 처리가 서로 다르다.
//   ① 스키마    필수 필드 누락·타입 불일치        → 해당 배치 반려
//   ② 값 범위    값 제약·요구연봉 ±30%·id 형식     → 해당 카드 제외
//   ③ 중복·유사도 id 중복·blurb 완전일치            → 초과분 제외 / 조합 5장 초과는 경고
//   ④ 실명 필터  금칙어 부분일치                    → 배치 전체 반려 + 즉시 보고, 부분 통과 없음
//
// ④는 00_PROJECT_BRIEF.md 가드레일 1의 기술적 담보다. 다른 검사와 달리 예외를 두지 않는다.
// 의존성 없음 — node 표준 라이브러리만 쓴다.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type Check = 1 | 2 | 3 | 4;
export type Disposition = "BATCH_REJECT" | "CARD_EXCLUDE" | "WARN";

export type Finding = {
  check: Check;
  disposition: Disposition;
  file: string;
  id: string;
  message: string;
};

type Schema = Record<string, any>;
type Card = Record<string, unknown>;

const TARGETS = [
  { file: "teachers.json", schema: "teacher.schema.json" },
  { file: "events.json", schema: "event.schema.json" },
  { file: "headlines.json", schema: "headline.schema.json" },
];

// banned-terms.txt [5]. 차단이 아니라 사람 확인 대상이다.
const PROPER_NOUN = /(\S+)(학원|에듀|아카데미|입시|교육)/gu;

// 동일 (subject, teaching, fame, trait) 조합이 이 수를 넘으면 경고
const COMBO_WARN_OVER = 5;

// ─────────────────────────────── 공통 유틸

const isPlainObject = (v: unknown): v is Card =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const child = (path: string, key: string) => (path ? `${path}.${key}` : key);

const typeName = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

/** 대소문자·공백 무시 부분일치용 정규화 (banned-terms.txt 작성 규칙 4) */
const foldForMatch = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/gu, "");

/** blurb 유사도 판정용 정규화 — 공백·문장부호·대소문자를 지운 뒤 완전일치를 본다 */
const foldForBlurb = (s: string) =>
  s.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

/** 카드 안의 모든 문자열 값을 경로와 함께 모은다 */
function collectStrings(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") return [[path || "카드", value]];
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([k, v]) => collectStrings(v, child(path, k)));
}

// ─────────────────────────────── ① 스키마 대조 (구조)

/** 필수 필드 누락 · 타입 불일치 · 스키마에 없는 필드만 본다. 값 제약은 ②가 맡는다. */
function shapeErrors(value: unknown, schema: Schema, path = ""): string[] {
  const at = path || "카드";

  if (schema.type === "object") {
    if (!isPlainObject(value)) return [`${at}: 객체여야 한다 (${typeName(value)})`];
    const out: string[] = [];
    for (const key of schema.required ?? []) {
      if (!(key in value)) out.push(`${child(path, key)}: 필수 필드 누락`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!schema.properties?.[key]) out.push(`${child(path, key)}: 스키마에 없는 필드`);
      }
    }
    for (const [key, sub] of Object.entries<Schema>(schema.properties ?? {})) {
      if (key in value) out.push(...shapeErrors(value[key], sub, child(path, key)));
    }
    return out;
  }

  if (schema.type === "string" && typeof value !== "string") {
    return [`${at}: 문자열이어야 한다 (${typeName(value)})`];
  }
  if ((schema.type === "integer" || schema.type === "number") && typeof value !== "number") {
    return [`${at}: 숫자여야 한다 (${typeName(value)})`];
  }
  return [];
}

// ─────────────────────────────── ② 값 범위

function valueErrors(value: unknown, schema: Schema, path = ""): string[] {
  const at = path || "카드";
  const out: string[] = [];

  if (schema.type === "object") {
    if (!isPlainObject(value)) return out; // 구조 오류는 ①이 이미 잡았다
    if (schema.minProperties != null && Object.keys(value).length < schema.minProperties) {
      out.push(`${at}: 속성이 ${schema.minProperties}개 이상이어야 한다`);
    }
    for (const [key, sub] of Object.entries<Schema>(schema.properties ?? {})) {
      if (key in value) out.push(...valueErrors(value[key], sub, child(path, key)));
    }
    return out;
  }

  if (schema.enum && !schema.enum.includes(value as never)) {
    out.push(`${at}: 허용되지 않은 값 "${String(value)}"`);
  }
  if (typeof value === "string") {
    const len = [...value].length;
    if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
      out.push(`${at}: 형식 불일치 "${value}"`);
    }
    if (schema.minLength != null && len < schema.minLength) {
      out.push(`${at}: ${schema.minLength}자 이상이어야 한다 (${len}자)`);
    }
    if (schema.maxLength != null && len > schema.maxLength) {
      out.push(`${at}: ${schema.maxLength}자 이하여야 한다 (${len}자)`);
    }
  }
  if (typeof value === "number") {
    if (schema.type === "integer" && !Number.isInteger(value)) out.push(`${at}: 정수여야 한다`);
    if (schema.minimum != null && value < schema.minimum) {
      out.push(`${at}: ${schema.minimum} 이상이어야 한다 (${value})`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      out.push(`${at}: ${schema.maximum} 이하여야 한다 (${value})`);
    }
  }
  return out;
}

/** 강사 카드 전용 — 요구연봉 = (강의력 + 인지도) × 3 의 ±30% 이내 (teacher.schema.json 42행) */
function askingPriceError(card: Card): string | null {
  const { teaching, fame, askingPrice } = card;
  if (typeof teaching !== "number" || typeof fame !== "number" || typeof askingPrice !== "number") {
    return null; // ①이 잡는다
  }
  const base = (teaching + fame) * 3;
  if (askingPrice < base * 0.7 || askingPrice > base * 1.3) {
    return `askingPrice: 기준식 (${teaching}+${fame})×3=${base} 의 ±30% 밖 (${askingPrice})`;
  }
  return null;
}

// ─────────────────────────────── ③ 중복·유사도

function duplicationFindings(cards: Card[], file: string): Finding[] {
  const out: Finding[] = [];
  const seenId = new Set<string>();
  const seenBlurb = new Map<string, string>();
  const combos = new Map<string, string[]>();

  cards.forEach((card, index) => {
    const id = cardId(card, index);

    if (typeof card.id === "string") {
      if (seenId.has(card.id)) {
        out.push(finding(3, "CARD_EXCLUDE", file, id, `id 중복 "${card.id}"`));
      }
      seenId.add(card.id);
    }

    if (typeof card.blurb === "string") {
      const key = foldForBlurb(card.blurb);
      const first = seenBlurb.get(key);
      if (first) {
        out.push(finding(3, "CARD_EXCLUDE", file, id, `blurb가 ${first}와 정규화 후 완전일치`));
      } else {
        seenBlurb.set(key, id);
      }
    }

    if (card.subject != null && card.trait != null) {
      const key = `${card.subject}/${card.teaching}/${card.fame}/${card.trait}`;
      combos.set(key, [...(combos.get(key) ?? []), id]);
    }
  });

  for (const [key, ids] of combos) {
    if (ids.length > COMBO_WARN_OVER) {
      out.push(
        finding(3, "WARN", file, ids[COMBO_WARN_OVER], `동일 조합 (${key}) ${ids.length}장 — ${COMBO_WARN_OVER}장 초과`),
      );
    }
  }
  return out;
}

// ─────────────────────────────── ④ 실명 필터

function bannedFindings(cards: Card[], file: string, terms: string[]): Finding[] {
  const out: Finding[] = [];
  const folded = terms.map((term) => [term, foldForMatch(term)] as const).filter(([, f]) => f);

  cards.forEach((card, index) => {
    const id = cardId(card, index);
    for (const [path, text] of collectStrings(card)) {
      const haystack = foldForMatch(text);
      for (const [term, needle] of folded) {
        if (haystack.includes(needle)) {
          out.push(finding(4, "BATCH_REJECT", file, id, `${path}: 금칙어 "${term}" 부분일치`));
        }
      }
    }
  });
  return out;
}

/** 고유명사형 토큰 경고 — 차단하지 않고 사람이 확인한다 (06 문서 3절 102행) */
function properNounWarnings(cards: Card[], file: string): Finding[] {
  const out: Finding[] = [];
  const reported = new Set<string>();

  cards.forEach((card, index) => {
    const id = cardId(card, index);
    for (const [path, text] of collectStrings(card)) {
      for (const match of text.matchAll(PROPER_NOUN)) {
        const token = match[0];
        if (reported.has(token)) continue;
        reported.add(token);
        out.push(finding(4, "WARN", file, id, `${path}: 고유명사형 토큰 "${token}" — 사람 확인 필요`));
      }
    }
  });
  return out;
}

// ─────────────────────────────── 조립

const finding = (check: Check, disposition: Disposition, file: string, id: string, message: string): Finding => ({
  check,
  disposition,
  file,
  id,
  message,
});

const cardId = (card: Card, index: number) =>
  typeof card.id === "string" && card.id ? card.id : `#${index}`;

export function loadBannedTerms(path: string): string[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

export type ValidateOptions = {
  contentDir?: string;
  schemaDir?: string;
  bannedPath?: string;
};

export function validate(options: ValidateOptions = {}): { findings: Finding[]; ok: boolean } {
  const contentDir = options.contentDir ?? "src/content";
  const schemaDir = options.schemaDir ?? "schema";
  const bannedPath = options.bannedPath ?? join(schemaDir, "banned-terms.txt");

  const terms = loadBannedTerms(bannedPath);
  const findings: Finding[] = [];

  for (const target of TARGETS) {
    const filePath = join(contentDir, target.file);
    let cards: unknown;
    try {
      cards = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      findings.push(finding(1, "BATCH_REJECT", target.file, "-", `읽을 수 없다: ${(error as Error).message}`));
      continue;
    }
    if (!Array.isArray(cards)) {
      findings.push(finding(1, "BATCH_REJECT", target.file, "-", "최상위가 배열이 아니다"));
      continue;
    }

    const schema: Schema = JSON.parse(readFileSync(join(schemaDir, target.schema), "utf8"));

    cards.forEach((raw, index) => {
      const card = (isPlainObject(raw) ? raw : {}) as Card;
      const id = cardId(card, index);

      for (const message of shapeErrors(raw, schema)) {
        findings.push(finding(1, "BATCH_REJECT", target.file, id, message));
      }
      for (const message of valueErrors(raw, schema)) {
        findings.push(finding(2, "CARD_EXCLUDE", target.file, id, message));
      }
      if (target.file === "teachers.json") {
        const message = askingPriceError(card);
        if (message) findings.push(finding(2, "CARD_EXCLUDE", target.file, id, message));
      }
    });

    const cardList = cards.filter(isPlainObject);
    findings.push(...duplicationFindings(cardList, target.file));
    findings.push(...bannedFindings(cardList, target.file, terms));
    findings.push(...properNounWarnings(cardList, target.file));
  }

  return { findings, ok: findings.every((f) => f.disposition === "WARN") };
}

// ─────────────────────────────── 리포트

const CHECK_LABEL: Record<Check, string> = {
  1: "① 스키마",
  2: "② 값 범위",
  3: "③ 중복·유사도",
  4: "④ 실명 필터",
};

const DISPOSITION_LABEL: Record<Disposition, string> = {
  BATCH_REJECT: "배치 전체 반려",
  CARD_EXCLUDE: "해당 카드 제외",
  WARN: "경고 — 사람 확인",
};

export function report(findings: Finding[], contentDir: string): string {
  const lines = [`콘텐츠 검증: ${contentDir}`, ""];

  // ④ 위반은 부분 통과가 없으므로 맨 위에 즉시 보고한다
  const order: Array<[Check, Disposition]> = [
    [4, "BATCH_REJECT"],
    [1, "BATCH_REJECT"],
    [2, "CARD_EXCLUDE"],
    [3, "CARD_EXCLUDE"],
    [3, "WARN"],
    [4, "WARN"],
  ];

  for (const [check, disposition] of order) {
    const group = findings.filter((f) => f.check === check && f.disposition === disposition);
    if (!group.length) continue;
    lines.push(`[${CHECK_LABEL[check]}] ${DISPOSITION_LABEL[disposition]} — ${group.length}건`);
    if (check === 4 && disposition === "BATCH_REJECT") {
      lines.push("  가드레일 1 위반. 부분 통과를 허용하지 않는다. 배치를 반려하고 즉시 보고할 것.");
    }
    for (const f of group) lines.push(`  ${f.file} ${f.id} — ${f.message}`);
    lines.push("");
  }

  const count = (d: Disposition) => findings.filter((f) => f.disposition === d).length;
  lines.push(
    findings.length
      ? `요약: 배치 반려 ${count("BATCH_REJECT")}건 / 카드 제외 ${count("CARD_EXCLUDE")}건 / 경고 ${count("WARN")}건`
      : "요약: 위반 0건",
  );
  return lines.join("\n");
}

// ─────────────────────────────── CLI

function main(argv: string[]): number {
  const arg = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const contentDir = arg("content") ?? "src/content";
  const options = { contentDir, schemaDir: arg("schema"), bannedPath: arg("banned") };

  const { findings, ok } = validate(options);
  console.log(report(findings, contentDir));
  return ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
