import { test } from "node:test";
import assert from "node:assert/strict";

import { validate } from "./validate-content.ts";

const BANNED = "scripts/fixtures/banned-terms.txt";
const bad = () => validate({ contentDir: "scripts/fixtures/bad", bannedPath: BANNED });
const clean = () => validate({ contentDir: "scripts/fixtures/clean", bannedPath: BANNED });

/** 지정한 검사·처리·카드의 findings가 정확히 1건 있는지 본다 */
function one(findings, check, disposition, id, fragment) {
  const hits = findings.filter(
    (f) => f.check === check && f.disposition === disposition && f.id === id && f.message.includes(fragment),
  );
  assert.equal(hits.length, 1, `검사 ${check}/${disposition}/${id}/"${fragment}" 가 ${hits.length}건`);
}

test("정상 배치는 위반도 경고도 없이 통과한다", () => {
  const { findings, ok } = clean();
  assert.deepEqual(findings, []);
  assert.equal(ok, true);
});

test("① 스키마 — 필수 필드 누락과 타입 불일치는 배치 반려", () => {
  const { findings } = bad();
  one(findings, 1, "BATCH_REJECT", "t_0002", "trait: 필수 필드 누락");
  one(findings, 1, "BATCH_REJECT", "t_0003", "teaching: 숫자여야 한다");
  one(findings, 1, "BATCH_REJECT", "e_0002", "trigger.minTurn: 필수 필드 누락");
});

test("② 값 범위 — 값 제약 위반은 해당 카드만 제외", () => {
  const { findings } = bad();
  one(findings, 2, "CARD_EXCLUDE", "t_0004", "±30% 밖"); // 요구연봉 (1+1)×3=6 에 40
  one(findings, 2, "CARD_EXCLUDE", "t_0005", "5 이하여야 한다"); // 강의력 7
  one(findings, 2, "CARD_EXCLUDE", "x_0006", "형식 불일치"); // id 패턴
  one(findings, 2, "CARD_EXCLUDE", "e_0004", 'requires: 허용되지 않은 값 "CASH_ABOVE_99"');
  one(findings, 2, "CARD_EXCLUDE", "h_0002", 'situation: 허용되지 않은 값 "BID_TIED"');
});

test("② 값 범위 — 타입이 틀린 필드는 ①만 잡고 ②로 중복 계상하지 않는다", () => {
  const { findings } = bad();
  assert.equal(findings.filter((f) => f.id === "t_0003" && f.check === 2).length, 0);
});

test("③ 중복 — id 중복과 blurb 완전일치는 초과분만 제외", () => {
  const { findings } = bad();
  one(findings, 3, "CARD_EXCLUDE", "t_0001", 'id 중복 "t_0001"');
  one(findings, 3, "CARD_EXCLUDE", "h_0001", 'id 중복 "h_0001"');
  // "상위반을, 맡길 만하다!" 는 정규화하면 t_0001 과 같아진다
  one(findings, 3, "CARD_EXCLUDE", "t_0008", "정규화 후 완전일치");
});

test("③ 유사도 — 동일 조합 5장 초과는 경고일 뿐 반려가 아니다", () => {
  const { findings } = bad();
  one(findings, 3, "WARN", "t_0014", "동일 조합 (MATH/3/3/FACTION) 6장");
});

test("④ 실명 필터 — 어느 파일 어느 필드든 배치 전체 반려", () => {
  const { findings } = bad();
  one(findings, 4, "BATCH_REJECT", "t_0015", '금칙어 "무지개학원"'); // name
  one(findings, 4, "BATCH_REJECT", "t_0016", '금칙어 "별빛에듀"'); // blurb
  one(findings, 4, "BATCH_REJECT", "h_0004", '금칙어 "테스트강사"'); // headlines.json
});

test("④ 실명 필터 — 대소문자·공백을 무시하고 부분일치한다", () => {
  // 같은 clean 픽스처를, 정규화해야만 걸리는 금칙어 목록으로 다시 돌린다
  const { findings, ok } = validate({
    contentDir: "scripts/fixtures/clean",
    bannedPath: "scripts/fixtures/banned-terms.test-fold.txt",
  });
  one(findings, 4, "BATCH_REJECT", "t_0101", '금칙어 "상위반을 맡길"'); // 공백 차이
  one(findings, 4, "BATCH_REJECT", "t_0101", '금칙어 "T_0101"'); // 대소문자 차이
  assert.equal(ok, false);
});

test("고유명사형 토큰은 차단이 아니라 경고", () => {
  const { findings } = bad();
  one(findings, 4, "WARN", "t_0015", '고유명사형 토큰 "무지개학원"');
  assert.equal(findings.filter((f) => f.check === 4 && f.disposition === "WARN").length, 2);
});

test("경고만 있으면 통과, 반려나 제외가 있으면 실패", () => {
  assert.equal(bad().ok, false);
  assert.equal(clean().ok, true);
});
