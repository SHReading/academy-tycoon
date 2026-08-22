import { createInitialState, refillMarket, resolveGameEnd } from "../core/game";
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
  ["FRANCHISE", "확장형", "큰돈으로 시장을 주도합니다.", "매 학기 월급 부담이 큽니다."],
  ["LEGACY", "명문형", "높은 학원 인기로 학생을 지킵니다.", "새 강사를 데려오기 어렵습니다."],
  ["SELECTIVE", "선발형", "쉽게 망하지 않고 버티기 좋습니다.", "시작 자금이 가장 적어 영입 경쟁에서 밀립니다."],
];

const subjectLabels: Record<Subject, string> = {
  KOREAN: "국어",
  MATH: "수학",
  ENGLISH: "영어",
  SCIENCE: "탐구",
};

const tierLabels: Record<ClassTier, string> = {
  TOP: "상위반",
  UPPER_MID: "중상위반",
  MID: "중위반",
  BASIC: "기초반",
};

const tierDescriptions: Record<ClassTier, string> = {
  TOP: "학원 인기에 유리",
  UPPER_MID: "인기와 학생 수 둘 다",
  MID: "학생 수에 유리",
  BASIC: "학생 유지에 유리",
};

const options: ReadonlyArray<readonly [OperationOption, string, string]> = [
  ["SELF_STUDY", "자습 감독 강화", "돈을 써서 그만두는 학생을 줄입니다."],
  ["SCHOLARSHIP", "장학금 확대", "돈을 써서 더 많은 학생을 모읍니다."],
  ["NONE", "아무것도 안 함", "돈을 쓰지 않고 이번 학기를 운영합니다."],
];

const turnLabels = ["첫", "둘째", "셋째", "넷째", "다섯째", "마지막"];

let screen = 0;
let seed = 1;
let state: GameState | null = null;
let selectedTeacherId = "";
let selectedOwnedTeacherId = "";

const player = () => state?.academies.find(({ archetype }) => archetype === state?.playerArchetype);
const teacherById = (id: string) => player()?.teachers.find((teacher) => teacher.id === id);
const dots = (value: number) => `${"●".repeat(value)}${"○".repeat(5 - value)}`;
const stars = (value: number) => {
  const filled = Math.max(0, Math.min(5, Math.round(value / 20)));
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
};
const easyHeadline = (text: string) => text
  .replaceAll("평판", "학원 인기")
  .replaceAll("점유율", "학생 점유")
  .replaceAll("자금", "돈");
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
      <p class="premise">재수학원 세 곳이 같은 강사를 놓고 6학기 동안 경쟁합니다. 내가 지르지 않으면 경쟁 학원이 데려갑니다.</p>
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
    <span class="ratings" aria-label="실력 ${teacher.teaching}, 유명세 ${teacher.fame}">
      <small>실력 ${dots(teacher.teaching)}</small>
      <small>유명세 ${dots(teacher.fame)}</small>
    </span>
    <small>원하는 월급 ${teacher.askingPrice}</small>
  </button>
`;

const bidScreen = () => {
  const academy = player();
  const selected = state?.market.find(({ id }) => id === selectedTeacherId) ?? state?.market[0];
  if (!state || !academy || !selected) return academyScreen();
  selectedTeacherId = selected.id;
  const fixedCost = academy.contracts.reduce((sum, contract) => sum + contract.price, 0);
  return `
    <section class="screen">
      ${progress("강사 입찰 단계")}
      <header class="screen-header compact bid-header">
        <div>
          <p class="eyebrow">블라인드 입찰</p>
          <h1>이번 시장의 강사</h1>
        </div>
        <p class="cash-chip">
          <span>가진 돈 <strong>${Math.round(academy.cash)}</strong></span>
          <span>매 학기 월급 <strong>−${fixedCost}</strong></span>
        </p>
      </header>
      <p class="screen-summary">내가 놓친 강사는 경쟁 학원의 전력이 됩니다.</p>
      <div class="market-grid" aria-label="강사 시장">${state.market.map(marketCard).join("")}</div>
      <form class="decision-panel" data-bid-form>
        <label for="bid-amount">제시할 월급</label>
        <input id="bid-amount" name="bid" type="number" min="${selected.askingPrice}" value="${selected.askingPrice}" inputmode="numeric" required>
        <button class="primary-button" type="submit">
          이 월급으로 제안
          <small>가장 높은 월급을 제시하면 영입하며, 그 월급은 매 학기 나갑니다.</small>
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
  selectedOwnedTeacherId = teacherById(selectedOwnedTeacherId)?.id ?? academy.teachers[0]?.id ?? "";
  return `
    <section class="screen wide-screen">
      ${progress("반 편성과 운영 선택 단계")}
      <header class="screen-header compact">
        <p class="eyebrow">반 편성</p>
        <h1>어느 반에 힘을 실을까요?</h1>
        <p>강사를 고른 뒤 원하는 반의 빈 자리를 누르면 이동합니다.</p>
      </header>
      <div class="teacher-roster" aria-label="보유 강사">
        ${academy.teachers.map((teacher) => `
          <button class="roster-card ${teacher.id === selectedOwnedTeacherId ? "is-selected" : ""}" data-owned-teacher="${teacher.id}" aria-pressed="${teacher.id === selectedOwnedTeacherId}">
            <small>${subjectLabels[teacher.subject]}</small><strong>${teacher.name}</strong>
            <span class="ratings" aria-label="실력 ${teacher.teaching}">
              <small>실력 ${dots(teacher.teaching)}</small>
            </span>
          </button>
        `).join("")}
      </div>
      <div class="class-board">
        ${(Object.keys(tierLabels) as ClassTier[]).map((tier) => `
          <section class="class-row">
            <div class="class-title">
              <strong>${tierLabels[tier]}</strong>
              <small>${tierDescriptions[tier]}</small>
            </div>
            <div class="slot-grid">
              ${Array.from({ length: 2 }, (_, index) => {
                const assigned = teacherById(academy.assignments[tier]?.[index] ?? "");
                return `
                  <button class="teacher-slot ${assigned ? "is-filled" : ""}" type="button" data-tier="${tier}" aria-label="${tierLabels[tier]} ${index + 1}번 자리: ${assigned ? `${assigned.name}, 실력 ${assigned.teaching}` : "빈 자리"}">
                    <span>${assigned?.name ?? "빈 자리"}</span>
                    ${assigned ? `<small aria-hidden="true">실력 ${dots(assigned.teaching)}</small>` : ""}
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
        학기 결과 보기
        <small>반 배치와 운영 선택을 반영한 결과를 봅니다.</small>
      </button>
    </section>
  `;
};

const resultScreen = () => {
  const current = state;
  const academy = player();
  const result = current?.lastResult;
  if (!current || !academy || !result) return academyScreen();
  const status = current.status ?? "PLAYING";
  const isOver = status !== "PLAYING";
  const rivals = current.academies.filter(({ archetype }) => archetype !== current.playerArchetype);
  const fixedCost = academy.contracts.reduce((sum, contract) => sum + contract.price, 0);
  const winner = academies.find(([archetype]) => archetype === current.winner)?.[1];
  const title = status === "WON" ? "시장 정상" : isOver ? "게임 종료" : "교문 앞 소식";
  const outcome = status === "WON"
    ? academy.cash < 0
      ? "적자를 안고도 학생 점유 선두를 지켰습니다."
      : "최종 학생 점유 선두로 승리했습니다."
    : status === "LOST"
      ? current.deficitStreak === 2
        ? "두 학기 연속 적자로 폐원했습니다."
        : `${winner ?? "경쟁 학원"}이 최종 학생 점유 선두를 차지했습니다.`
      : "";
  return `
    <section class="screen result-screen">
      ${progress("학기 결과 단계")}
      <header class="result-masthead">
        <p class="eyebrow">${turnLabels[result.turn - 1]} 학기 결과 속보</p>
        <h1>${title}</h1>
      </header>
      <div class="headlines" aria-label="이번 학기 주요 소식">
        ${result.headlines.map(({ text }) => `<p>「${easyHeadline(text)}」</p>`).join("")}
      </div>
      ${outcome ? `<p class="outcome outcome--${status.toLowerCase()}">${outcome}</p>` : ""}
      <dl class="result-stats" aria-label="보조 지표">
        <div><dt>학생 점유</dt><dd>${Math.round(academy.marketShare * 100)}%</dd></div>
        <div><dt>남은 돈</dt><dd>${Math.round(academy.cash)}</dd></div>
        <div><dt>매 학기 월급</dt><dd>${fixedCost}</dd></div>
      </dl>
      <p class="popularity">학원 인기 <strong>${stars(academy.reputation)}</strong></p>
      <section class="rival-panel" aria-label="경쟁 학원 현황">
        <h2>경쟁 학원 현황</h2>
        <dl class="rival-stats">
          ${rivals.map((rival) => `
            <div>
              <dt>${academies.find(([archetype]) => archetype === rival.archetype)?.[1]}</dt>
              <dd>
                <span>학원 인기 <strong>${stars(rival.reputation)}</strong></span>
                <span>학생 점유 <i class="share-bar" role="progressbar" aria-label="학생 점유" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(rival.marketShare * 100)}"><span style="width:${rival.marketShare * 100}%"></span></i></span>
              </dd>
            </div>
          `).join("")}
        </dl>
      </section>
      <button class="primary-button restart-button" ${isOver ? "data-restart" : "data-next"}>
        ${isOver ? "같은 학원으로 다시 시작" : "다음 학기 시작"}
        <small>${isOver ? "한 번 누르면 새 시장에서 즉시 다시 시작합니다." : "영입되지 않은 강사는 원하는 월급을 낮춰 다시 나옵니다."}</small>
      </button>
    </section>
  `;
};

const screens = [academyScreen, bidScreen, assignmentScreen, resultScreen];

const render = () => {
  app.innerHTML = screens[screen]();
  document.title = `${["학원 선택", "강사 입찰", "반 편성", "학기 결과"][screen]} · 학원 타이쿤`;
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
    state = resolveGameEnd(reducer(state, { type: "SETTLE" }));
    screen = 3;
  } else if (button.dataset.next !== undefined && state) {
    state = refillMarket(state);
    selectedTeacherId = state.market[0]?.id ?? "";
    screen = 1;
  } else if (button.dataset.restart !== undefined && state) {
    seed += 1;
    state = createInitialState(seed, state.playerArchetype);
    selectedTeacherId = state.market[0]?.id ?? "";
    selectedOwnedTeacherId = "";
    screen = 1;
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
