import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const assignment = source.slice(
  source.indexOf("const assignmentScreen"),
  source.indexOf("const resultScreen"),
);

test("반 편성은 과목 칸 없이 네 반에 강사를 두 명씩 배치한다", () => {
  assert.match(source, /UPPER_MID: "중상위반"/);
  assert.match(source, /학원 인기에 유리/);
  assert.match(source, /인기와 학생 수 둘 다/);
  assert.match(source, /학생 수에 유리/);
  assert.match(source, /학생 유지에 유리/);
  assert.match(assignment, /Array\.from\(\{ length: 2 \}/);
  assert.doesNotMatch(assignment, /Object\.keys\(subjectLabels\)/);
  assert.doesNotMatch(assignment, /selected\?\.subject/);
});

test("학원 카드 본문 클릭은 강사 입찰 화면으로 바로 이동한다", () => {
  assert.match(source, /<button class="academy-card[^>]+data-academy=/);
  assert.match(source, /if \(button\.dataset\.academy\)[\s\S]+?screen = 1;/);
});

test("적자로 이긴 판은 빚을 숨기지 않고, 첫 화면이 소재를 설명한다", () => {
  // 승리 문구가 자금 부호로 갈라진다 — "승리했습니다 / 남은 돈 -10" 부조화 방지
  assert.match(source, /status === "WON"[\s\S]{0,120}academy\.cash < 0/);
  assert.match(source, /적자를 안고도 학생 점유 선두를 지켰습니다/);
  assert.match(source, /최종 학생 점유 선두로 승리했습니다/);
  // 첫 화면이 재수학원·강사 경쟁·기간을 스스로 밝힌다 (튜토리얼 화면 없음 원칙 유지)
  assert.match(source, /재수학원 세 곳이 같은 강사를 놓고 6학기 동안 경쟁합니다/);
});
