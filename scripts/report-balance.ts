// 하네스 출력(JSON) → 마크다운 리포트 (06 문서 1절)
//
//   npm run --silent sim -- --games 100000 --seed 1 > sim.json
//   node scripts/report-balance.ts sim.json > 리포트.md
//   (파일 인자를 안 주면 표준입력에서 읽는다. --silent 를 빼면 npm 배너가 JSON 앞에 섞인다)
//
// 판정 3개를 맨 위에 둔다. 사람이 리포트에서 제일 먼저 보는 줄이 그것이어야 한다. (D-6)

import { readFileSync } from "node:fs";

type Report = {
  games: number;
  seedFrom: number;
  seedTo: number;
  elapsedMs: number;
  deckSource: string;
  verdicts: { noBidDominant: boolean; strategySkew: boolean; archetypeSkew: boolean };
  winRateByStrategy: Record<string, number>;
  winRateByArchetype: Record<string, number>;
  bidWinRate: number;
  gameLength: Record<string, number>;
  bankruptRate: number;
  bankruptRateByArchetype: Record<string, number>;
  bidsPerGameByArchetype: Record<string, number>;
  notes: string[];
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

const QUESTIONS = [
  {
    key: "noBidDominant" as const,
    question: "무입찰 전략이 지배전략인가",
    threshold: "무입찰 승률 > 40%",
    read: (report: Report) => percent(report.winRateByStrategy.NO_BID ?? 0),
  },
  {
    key: "strategySkew" as const,
    question: "상위반 몰빵 / 중위반 확장 중 하나가 항상 이기는가",
    threshold: "한쪽 승률 > 60%",
    read: (report: Report) =>
      `상위반 ${percent(report.winRateByStrategy.TOP_HEAVY ?? 0)} / 중위반 ${percent(report.winRateByStrategy.MID_EXPAND ?? 0)}`,
  },
  {
    key: "archetypeSkew" as const,
    question: "3개 아키타입 승률이 40:30:30 안에 드는가",
    threshold: "최대 편차 > 15%p",
    read: (report: Report) => {
      const rates = Object.values(report.winRateByArchetype);
      if (rates.length < 2) return "-";
      return `편차 ${((Math.max(...rates) - Math.min(...rates)) * 100).toFixed(1)}%p`;
    },
  },
];

function table(rows: Array<string[]>, header: string[]): string[] {
  return [
    `| ${header.join(" | ")} |`,
    `|${header.map(() => "---").join("|")}|`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ];
}

export function render(report: Report): string {
  const failed = QUESTIONS.filter((entry) => report.verdicts[entry.key]);

  const lines = [
    "# 밸런싱 시뮬레이션 리포트",
    "",
    `표본 ${report.games.toLocaleString()}판 · 시드 ${report.seedFrom}~${report.seedTo} · ${(report.elapsedMs / 1000).toFixed(1)}초 · 강사 풀 ${report.deckSource}`,
    "",
    "## 판정 3개",
    "",
    ...table(
      QUESTIONS.map((entry) => [
        report.verdicts[entry.key] ? "**실패**" : "통과",
        entry.question,
        entry.threshold,
        entry.read(report),
      ]),
      ["판정", "질문", "실패 기준", "관측"],
    ),
    "",
    failed.length
      ? `**${failed.length}개 항목이 실패 기준을 넘었다.** 수치를 고칠지는 사람이 정한다 — 이 리포트는 보고까지가 역할이다. (07 문서 작업 D)`
      : "세 질문 모두 실패 기준 아래다.",
    "",
    "## 전략별 승률",
    "",
    ...table(
      Object.entries(report.winRateByStrategy).map(([name, value]) => [name, percent(value)]),
      ["전략", "승률"],
    ),
    "",
    "## 아키타입별 (플레이어가 잡았을 때)",
    "",
    ...table(
      Object.entries(report.winRateByArchetype).map(([name, value]) => [
        name,
        percent(value),
        percent(report.bankruptRateByArchetype?.[name] ?? 0),
        (report.bidsPerGameByArchetype?.[name] ?? 0).toFixed(2),
      ]),
      ["아키타입", "승률", "폐원률", "입찰 시도/판"],
    ),
    "",
    "## 추가 지표",
    "",
    ...table(
      [
        ["턴당 입찰 성공률", percent(report.bidWinRate)],
        ["조기 폐원 비율", percent(report.bankruptRate)],
      ],
      ["항목", "값"],
    ),
    "",
    "### 게임 길이 분포",
    "",
    ...table(
      Object.entries(report.gameLength)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([turn, count]) => [
          `${turn}턴`,
          count.toLocaleString(),
          percent(count / report.games),
        ]),
      ["종료 턴", "판수", "비율"],
    ),
    "",
    "## 이 수치를 읽기 전에",
    "",
    ...report.notes.map((note) => `- ${note}`),
  ];

  return lines.join("\n");
}

function main(argv: string[]): number {
  const source = argv[0];
  let raw: string;
  try {
    raw = readFileSync(source ?? 0, "utf8");
  } catch (error) {
    console.error(`입력을 읽지 못했다: ${(error as Error).message}`);
    return 1;
  }
  console.log(render(JSON.parse(raw) as Report));
  return 0;
}

if (process.argv[1]?.endsWith("report-balance.ts")) {
  process.exit(main(process.argv.slice(2)));
}
