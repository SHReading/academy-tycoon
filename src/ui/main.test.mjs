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
