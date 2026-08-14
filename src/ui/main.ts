import { createInitialState } from "../core/game";
import { reducer } from "../core/reducer";
import type {
  Archetype,
  ClassTier,
  GameState,
  OperationOption,
  Subject,
  TeacherCard,
} from "../core/types";
import "../styles/app.css";

const app = document.querySelector<HTMLElement>("#app");

if (!app) throw new Error("게임 화면을 찾을 수 없습니다.");

const academies: ReadonlyArray<readonly [Archetype, string, string, string]> = [
  ["FRANCHISE", "확장형", "큰 자금으로 시장을 주도합니다.", "고정비가 높아 오래 끌수록 불리합니다."],
  ["LEGACY", "명문형", "높은 평판으로 학생을 지킵니다.", "새 강사를 데려오기 어렵습니다."],
  ["SELECTIVE", "선발형", "상위반 성과와 영입에 강합니다.", "자금과 정원이 가장 작습니다."],
];

const subjectLabels: Record<Subject, string> = {
  KOREAN: "국어",
  MATH: "수학",
  ENGLISH: "영어",
  SCIENCE: "탐구",
};

const tierLabels: Record<ClassTier, string> = {
  TOP: "상위반",
  MID: "중위반",
  BASIC: "기초반",
};

const options: ReadonlyArray<readonly [OperationOption, string, string]> = [
  ["SELF_STUDY", "자습 감독 강화", "이탈률을 낮추는 대신 운영비가 듭니다."],
  ["COUNSELING", "담임 상담 확대", "성적과 평판을 함께 끌어올립니다."],
  ["SCHOLARSHIP", "장학금 확대", "큰 비용으로 지원자를 더 모읍니다."],
  ["TUITION_HIKE", "수강료 인상", "매출은 늘지만 지원자와 평판이 줄어듭니다."],
  ["NONE", "아무것도 안 함", "비용 없이 이번 학기를 운영합니다."],
];

let screen = 0;
let seed = 1;
let state: GameState | null = null;
let selectedTeacherId = "";
let selectedOwnedTeacherId = "";

const player = () => state?.academies.find(({ archetype }) => archetype === state?.playerArchetype);
const teacherById = (id: string) => player()?.teachers.find((teacher) => teacher.id === id);
const dots = (value: number) => `${"●".repeat(value)}${"○".repeat(5 - value)}`;
const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

const progress = (label: string) => `
  <div class="progress" role="img" aria-label="${label}">
    ${[0, 1, 2, 3].map((step) => `<span class="${step === screen ? "is-current" : ""}"></span>`).join("")}
  </div>
`;

const academyScreen = () => `
  <section class="screen academy-screen">
    ${progress("학원 선택 단계")}
    <header class="screen-header">
      <p class="eyebrow">학원 타이쿤</p>
      <h1>어떤 방식으로<br>입시 시장을 차지할까요?</h1>
      <p>선택한 학원의 강점이 곧 전략이 됩니다.</p>
    </header>
    <div class="academy-grid">
      ${academies.map(([archetype, title, strength, weakness]) => `
        <button class="academy-card academy-card--${archetype.toLowerCase()}" data-academy="${archetype}">
          <span class="card-kicker">${title}</span>
          <strong>${strength}</strong>
          <small>${weakness}</small>
          <span class="button-note">이 학원으로 바로 시작</span>
        </button>
      `).join("")}
    </div>
  </section>
`;

const marketCard = (teacher: TeacherCard) => `
  <button class="market-card ${teacher.id === selectedTeacherId ? "is-selected" : ""}" data-teacher="${teacher.id}" aria-pressed="${teacher.id === selectedTeacherId}">
    <span class="subject">${subjectLabels[teacher.subject]}</span>
    <strong>${teacher.name}</strong>
    <span>${teacher.blurb}</span>
    <span class="ratings" aria-label="강의력 ${teacher.teaching}, 인지도 ${teacher.fame}">
      <small>강의력 ${dots(teacher.teaching)}</small>
      <small>인지도 ${dots(teacher.fame)}</small>
    </span>
    <small>최소 입찰 ${teacher.askingPrice}</small>
  </button>
`;

const bidScreen = () => {
  const academy = player();
  const selected = state?.market.find(({ id }) => id === selectedTeacherId) ?? state?.market[0];
  if (!state || !academy || !selected) return academyScreen();
  selectedTeacherId = selected.id;
  return `
    <section class="screen">
      ${progress("강사 입찰 단계")}
      <header class="screen-header compact">
        <div>
          <p class="eyebrow">블라인드 입찰</p>
          <h1>이번 시장의 강사</h1>
        </div>
        <p class="cash-chip">가용 자금 <strong>${Math.round(academy.cash)}</strong></p>
      </header>
      <p class="screen-summary">내가 놓친 강사는 경쟁 학원의 전력이 됩니다.</p>
      <div class="market-grid" aria-label="강사 시장">${state.market.map(marketCard).join("")}</div>
      <form class="decision-panel" data-bid-form>
        <label for="bid-amount">내 입찰가</label>
        <input id="bid-amount" name="bid" type="number" min="${selected.askingPrice}" value="${selected.askingPrice}" inputmode="numeric" required>
        <button class="primary-button" type="submit">
          입찰 확정
          <small>최고가가 낙찰되며, 낙찰가는 매 학기 고정비가 됩니다.</small>
        </button>
        <button class="secondary-button" type="button" data-skip-bid>
          이번 영입 건너뛰기
          <small>지출을 아끼지만 경쟁 학원이 강사를 데려갈 수 있습니다.</small>
        </button>
      </form>
    </section>
  `;
};

const assignmentScreen = () => {
  const academy = player();
  if (!academy) return academyScreen();
  const selected = teacherById(selectedOwnedTeacherId) ?? academy.teachers[0];
  selectedOwnedTeacherId = selected?.id ?? "";
  return `
    <section class="screen wide-screen">
      ${progress("반 편성과 운영 선택 단계")}
      <header class="screen-header compact">
        <p class="eyebrow">반 편성</p>
        <h1>어느 반에 힘을 실을까요?</h1>
        <p>강사를 고른 뒤 같은 과목 자리를 누르면 이동합니다.</p>
      </header>
      <div class="teacher-roster" aria-label="보유 강사">
        ${academy.teachers.map((teacher) => `
          <button class="roster-card ${teacher.id === selectedOwnedTeacherId ? "is-selected" : ""}" data-owned-teacher="${teacher.id}" aria-pressed="${teacher.id === selectedOwnedTeacherId}">
            <small>${subjectLabels[teacher.subject]}</small><strong>${teacher.name}</strong>
          </button>
        `).join("")}
      </div>
      <div class="class-board">
        ${(Object.keys(tierLabels) as ClassTier[]).map((tier) => `
          <section class="class-row">
            <div class="class-title">
              <strong>${tierLabels[tier]}</strong>
              <small>${tier === "TOP" ? "평판" : tier === "MID" ? "매출" : "이탈 방지"}에 유리</small>
            </div>
            <div class="slot-grid">
              ${(Object.keys(subjectLabels) as Subject[]).map((subject) => {
                const assigned = teacherById(academy.assignments[tier]?.[subject] ?? "");
                const enabled = selected?.subject === subject;
                return `
                  <button class="teacher-slot ${assigned ? "is-filled" : ""}" type="button" data-tier="${tier}" ${enabled ? "" : "disabled"}>
                    <small>${subjectLabels[subject]}</small><span>${assigned?.name ?? "빈 자리"}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </section>
        `).join("")}
      </div>
      <fieldset class="options-panel">
        <legend>운영 옵션 하나 선택</legend>
        ${options.map(([value, title, description]) => `
          <label class="option-card">
            <input type="radio" name="option" value="${value}" ${academy.option === value ? "checked" : ""}>
            <span><strong>${title}</strong><small>${description}</small></span>
          </label>
        `).join("")}
      </fieldset>
      <button class="primary-button" data-settle>
        학기 정산하기
        <small>배치와 운영 선택을 반영해 이번 학기 결과를 계산합니다.</small>
      </button>
    </section>
  `;
};

const resultScreen = () => {
  const academy = player();
  const result = state?.lastResult;
  if (!academy || !result) return academyScreen();
  return `
    <section class="screen result-screen">
      ${progress("학기 정산 결과 단계")}
      <header class="result-masthead">
        <p class="eyebrow">학기 정산 속보</p>
        <h1>교문 앞 소식</h1>
      </header>
      <div class="headlines" aria-label="이번 학기 주요 소식">
        ${result.headlines.map(({ text, tone }) => `<p class="headline--${tone.toLowerCase()}">「${text}」</p>`).join("")}
      </div>
      <dl class="result-stats" aria-label="보조 지표">
        <div><dt>시장 점유율</dt><dd>${Math.round(academy.marketShare * 100)}%</dd></div>
        <div><dt>평판</dt><dd>${Math.round(academy.reputation)}</dd></div>
        <div><dt>남은 자금</dt><dd>${Math.round(academy.cash)}</dd></div>
      </dl>
      <button class="primary-button restart-button" data-reset>
        새 판 시작
        <small>한 번 누르면 학원 선택부터 즉시 다시 시작합니다.</small>
      </button>
    </section>
  `;
};

const screens = [academyScreen, bidScreen, assignmentScreen, resultScreen];

const render = () => {
  app.innerHTML = screens[screen]();
  document.title = `${["학원 선택", "강사 입찰", "반 편성", "학기 정산"][screen]} · 학원 타이쿤`;
};

const showAssignment = (teacherId: string, amount: number) => {
  if (!state) return;
  state = reducer(state, { type: "BID", teacherId, amount });
  selectedOwnedTeacherId = player()?.teachers[0]?.id ?? "";
  screen = 2;
  render();
  scrollToTop();
};

app.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");
  if (!button || button.matches("[type=submit]")) return;

  if (button.dataset.academy) {
    state = createInitialState(seed, button.dataset.academy as Archetype);
    selectedTeacherId = state.market[0]?.id ?? "";
    screen = 1;
  } else if (button.dataset.teacher) {
    selectedTeacherId = button.dataset.teacher;
  } else if (button.dataset.skipBid !== undefined) {
    showAssignment("", 0);
    return;
  } else if (button.dataset.ownedTeacher) {
    selectedOwnedTeacherId = button.dataset.ownedTeacher;
  } else if (button.dataset.tier && state && selectedOwnedTeacherId) {
    state = reducer(state, {
      type: "ASSIGN",
      teacherId: selectedOwnedTeacherId,
      classTier: button.dataset.tier as ClassTier,
    });
  } else if (button.dataset.settle !== undefined && state) {
    state = reducer(state, { type: "SETTLE" });
    screen = 3;
  } else if (button.dataset.reset !== undefined) {
    seed += 1;
    state = null;
    screen = 0;
  }

  render();
  scrollToTop();
});

app.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.name !== "option" || !state) return;
  state = reducer(state, { type: "OPTION", option: input.value as OperationOption });
  render();
});

app.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-bid-form]") || !state) return;
  event.preventDefault();
  showAssignment(selectedTeacherId, Number(new FormData(event.target).get("bid")));
});

render();
