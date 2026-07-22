// 퀴즈 정답 수집 봇
// 공개 정답 블로그 피드에서 질문/정답(사실 정보)만 추출해 data/answers.json으로 저장한다.
// GitHub Actions가 1시간마다 실행한다. 로컬 실행: node scripts/collect-answers.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const QUIZ_APPS = [
  { id: "cashwalk", label: "캐시워크", keywords: ["캐시워크", "돈버는퀴즈"] },
  { id: "shinhan", label: "신한", keywords: ["신한"] },
  { id: "cashdoc", label: "캐시닥", keywords: ["캐시닥", "타임스프레드", "용돈퀴즈"] },
  { id: "kbpay", label: "KB Pay", keywords: ["kb pay", "kb페이", "kb스타뱅킹"] },
  { id: "okcashbag", label: "OK캐쉬백", keywords: ["ok캐쉬백", "오퀴즈"] },
];

// 토스 행운퀴즈는 의도적으로 수집하지 않는다 (앱인토스 심사 리스크)
const EXCLUDED = ["토스", "행운퀴즈"];

const PENDING_PATTERNS = [/잠시\s*후/, /공개\s*예정/, /업데이트\s*예정/, /^\?+$/];

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function matchApp(text) {
  if (EXCLUDED.some((k) => text.includes(k))) return null;
  const lower = text.toLowerCase();
  return QUIZ_APPS.find((a) => a.keywords.some((k) => lower.includes(k))) ?? null;
}

function isPending(answer) {
  return PENDING_PATTERNS.some((p) => p.test(answer));
}

function extractDateLabel(text) {
  const m = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : null;
}

async function fetchBloggerFeed(blogUrl, maxResults = 50) {
  const url = `${blogUrl}/feeds/posts/default?alt=json&max-results=${maxResults}`;
  const res = await fetch(url, { headers: { "user-agent": "quiz-jupjup-collector/1.0" } });
  if (!res.ok) throw new Error(`${blogUrl} HTTP ${res.status}`);
  const data = await res.json();
  return data?.feed?.entry ?? [];
}

// ── 소스 1: oneuljupjup.blogspot.com ──
// 형식: <div class="qb"><p><b>Q1.</b> 질문</p><p>정답: <b>답</b></p></div>
async function collectOneuljupjup() {
  const entries = await fetchBloggerFeed("https://oneuljupjup.blogspot.com");
  const items = [];
  for (const entry of entries) {
    const title = entry.title?.$t ?? "";
    const app = matchApp(title);
    if (!app || !entry.content?.$t) continue;
    const published = entry.published?.$t ?? null;
    const dateLabel = extractDateLabel(title);

    const blocks = entry.content.$t.match(/<div class="qb">[\s\S]*?<\/div>/g) ?? [];
    for (const block of blocks) {
      const paragraphs = block.match(/<p>[\s\S]*?<\/p>/g) ?? [];
      if (!paragraphs.length) continue;
      const question = stripTags(paragraphs[0]).replace(/^Q\d+\.\s*/, "").trim();
      const bolds = (block.match(/<b>([\s\S]*?)<\/b>/g) ?? [])
        .map((b) => stripTags(b))
        .filter((t) => !/^Q\d+\.?$/.test(t));
      const answer = bolds.length ? bolds[bolds.length - 1] : "";
      if (!question || !answer) continue;
      items.push({ appId: app.id, question, answer, published, dateLabel, source: "oneuljupjup" });
    }
  }
  return items;
}

// ── 소스 2: luckyquiz3.blogspot.com ──
// 형식: <div class="quiz-card"> <p class="quiz-question">질문</p>
//        ... <span class="a2 quiz-answer-highlight">&nbsp;답&nbsp;</span>
async function collectLuckyquiz3() {
  const entries = await fetchBloggerFeed("https://luckyquiz3.blogspot.com");
  const items = [];
  for (const entry of entries) {
    const title = entry.title?.$t ?? "";
    const category = (entry.category ?? []).map((c) => c.term).join(" ");
    const app = matchApp(`${category} ${title}`);
    if (!app || !entry.content?.$t) continue;
    const published = entry.published?.$t ?? null;
    const dateLabel = extractDateLabel(title);

    const cards = entry.content.$t.split(/<div class="quiz-card">/).slice(1);
    for (const card of cards) {
      const qMatch = card.match(/<p class="quiz-question">([\s\S]*?)<\/p>/);
      const aMatch = card.match(/quiz-answer-highlight[^>]*>([\s\S]*?)<\/span>/);
      if (!qMatch || !aMatch) continue;
      const question = stripTags(qMatch[1]);
      const answer = stripTags(aMatch[1]);
      if (!question || !answer) continue;
      items.push({ appId: app.id, question, answer, published, dateLabel, source: "luckyquiz3" });
    }
  }
  return items;
}

const COLLECTORS = [
  { name: "oneuljupjup", run: collectOneuljupjup },
  { name: "luckyquiz3", run: collectLuckyquiz3 },
];

function normalizeQuestion(q) {
  return q.replace(/\s+/g, "").slice(0, 60);
}

async function main() {
  const allItems = [];
  const sourceStatus = [];

  for (const collector of COLLECTORS) {
    try {
      const items = await collector.run();
      allItems.push(...items);
      sourceStatus.push({ name: collector.name, ok: true, items: items.length });
      console.log(`[${collector.name}] ${items.length}개 수집`);
    } catch (err) {
      sourceStatus.push({ name: collector.name, ok: false, error: String(err) });
      console.error(`[${collector.name}] 실패:`, err.message);
    }
  }

  if (!allItems.length) {
    console.error("모든 소스에서 수집 실패. 기존 파일을 유지합니다.");
    process.exitCode = 1;
    return;
  }

  // 앱별 그룹핑 → 최신 날짜만 유지 → 질문 기준 dedupe
  const apps = [];
  for (const app of QUIZ_APPS) {
    const items = allItems
      .filter((i) => i.appId === app.id)
      .sort((a, b) => new Date(a.published ?? 0) - new Date(b.published ?? 0));
    if (!items.length) continue;

    // 가장 최근 글의 dateLabel을 "오늘"로 간주
    const latestLabel = items[items.length - 1].dateLabel;
    const todays = items.filter((i) => i.dateLabel === latestLabel || i.dateLabel === null);

    const merged = new Map();
    for (const item of todays) {
      const key = normalizeQuestion(item.question);
      const existing = merged.get(key);
      const pending = isPending(item.answer);
      // 이미 확정 정답이 있으면 "잠시 후 공개"로 덮어쓰지 않는다
      if (existing && !existing.pending && pending) continue;
      merged.set(key, {
        question: item.question,
        answer: item.answer,
        pending,
        source: item.source,
      });
    }

    apps.push({
      id: app.id,
      label: app.label,
      dateLabel: latestLabel,
      updatedAt: items[items.length - 1].published,
      items: Array.from(merged.values()),
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    sources: sourceStatus,
    apps,
  };

  const outPath = join(ROOT, "data", "answers.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  const total = apps.reduce((n, a) => n + a.items.length, 0);
  console.log(`완료: ${apps.length}개 앱, ${total}개 문항 → data/answers.json`);
}

main();
