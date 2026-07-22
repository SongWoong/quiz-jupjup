import {
  BOT_DATA_URL,
  SOURCE_BLOG,
  FEED_MAX_RESULTS,
  QUIZ_APPS,
  EXCLUDED_KEYWORDS,
  type QuizApp,
} from "./config";

export interface QAItem {
  question: string;
  answer: string;
  /** 아직 정답이 공개되지 않은 문제 ("잠시 후 공개") */
  pending: boolean;
}

export interface AppAnswers {
  app: QuizApp;
  /** 글 제목에서 추출한 날짜 (예: "7월 22일") */
  dateLabel: string | null;
  /** 해당 앱의 가장 최근 글 발행 시각 */
  updatedAt: Date;
  items: QAItem[];
}

interface FeedEntry {
  title?: { $t: string };
  published?: { $t: string };
  content?: { $t: string };
}

/** fetch 시도 → CORS 등으로 실패하면 JSONP 폴백 */
async function fetchFeedJson(): Promise<unknown> {
  const url = `${SOURCE_BLOG}/feeds/posts/default?alt=json&max-results=${FEED_MAX_RESULTS}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return fetchFeedJsonp();
  }
}

let jsonpSeq = 0;

function fetchFeedJsonp(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const cb = `__jupjup_feed_cb_${++jsonpSeq}`;
    const script = document.createElement("script");
    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
    };
    (window as unknown as Record<string, unknown>)[cb] = (data: unknown) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("피드를 불러오지 못했어요"));
    };
    script.src = `${SOURCE_BLOG}/feeds/posts/default?alt=json-in-script&max-results=${FEED_MAX_RESULTS}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

/** 글 본문 HTML에서 질문/정답 쌍을 추출 */
function parseEntryContent(html: string): QAItem[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = doc.querySelectorAll(".qb");
  const items: QAItem[] = [];

  blocks.forEach((block) => {
    const firstP = block.querySelector("p");
    if (!firstP) return;
    const question = (firstP.textContent ?? "")
      .replace(/^\s*Q\d+\.\s*/, "")
      .trim();

    // 정답 = "Qn." 라벨을 제외한 마지막 <b>
    const bolds = Array.from(block.querySelectorAll("b")).filter(
      (b) => !/^Q\d+\.?$/.test((b.textContent ?? "").trim())
    );
    const answer = bolds.length
      ? (bolds[bolds.length - 1].textContent ?? "").trim()
      : "";

    if (!question || !answer) return;
    items.push({
      question,
      answer,
      pending: answer.includes("잠시 후"),
    });
  });

  return items;
}

function normalizeQuestion(q: string): string {
  return q.replace(/\s+/g, "").slice(0, 60);
}

function extractDateLabel(title: string): string | null {
  const m = title.match(/\((\d{1,2})월\s*(\d{1,2})일\)/);
  return m ? `${m[1]}월 ${m[2]}일` : null;
}

interface ParsedPost {
  published: Date;
  dateLabel: string | null;
  items: QAItem[];
}

interface BotDataApp {
  id: string;
  label: string;
  dateLabel: string | null;
  updatedAt: string;
  items: { question: string; answer: string; pending: boolean }[];
}

interface BotData {
  generatedAt: string;
  apps: BotDataApp[];
}

/** 1순위: 수집 봇이 갱신하는 JSON에서 로딩 */
async function loadFromBot(): Promise<AppAnswers[]> {
  // raw.githubusercontent는 캐시가 있어서 cache-bust 파라미터를 붙인다
  const res = await fetch(`${BOT_DATA_URL}?t=${Math.floor(Date.now() / 60000)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as BotData;
  if (!Array.isArray(data.apps) || !data.apps.length) {
    throw new Error("봇 데이터가 비어 있음");
  }

  const result: AppAnswers[] = [];
  for (const botApp of data.apps) {
    const app = QUIZ_APPS.find((a) => a.id === botApp.id);
    if (!app || !botApp.items?.length) continue;
    result.push({
      app,
      dateLabel: botApp.dateLabel,
      updatedAt: new Date(botApp.updatedAt),
      items: botApp.items,
    });
  }
  if (!result.length) throw new Error("표시할 앱 데이터 없음");
  return result;
}

/** 봇 JSON 우선, 실패 시 블로그 피드 직접 파싱으로 폴백 */
export async function loadAnswers(): Promise<AppAnswers[]> {
  try {
    return await loadFromBot();
  } catch {
    return loadFromFeed();
  }
}

/** 2순위(폴백): 블로그 피드를 직접 읽어 변환 */
async function loadFromFeed(): Promise<AppAnswers[]> {
  const data = (await fetchFeedJson()) as { feed?: { entry?: FeedEntry[] } };
  const entries = data?.feed?.entry ?? [];

  const postsByApp = new Map<string, ParsedPost[]>();

  for (const entry of entries) {
    const title = entry.title?.$t ?? "";
    if (!title || EXCLUDED_KEYWORDS.some((k) => title.includes(k))) continue;

    const app = QUIZ_APPS.find((a) =>
      a.keywords.some((k) => title.toLowerCase().includes(k.toLowerCase()))
    );
    if (!app || !entry.content?.$t) continue;

    const items = parseEntryContent(entry.content.$t);
    if (!items.length) continue;

    const posts = postsByApp.get(app.id) ?? [];
    posts.push({
      published: new Date(entry.published?.$t ?? 0),
      dateLabel: extractDateLabel(title),
      items,
    });
    postsByApp.set(app.id, posts);
  }

  const result: AppAnswers[] = [];

  for (const app of QUIZ_APPS) {
    const posts = postsByApp.get(app.id);
    if (!posts?.length) continue;

    // 가장 최근 발행 글의 날짜 라벨 = "오늘"로 간주하고, 같은 날짜의 글만 병합
    posts.sort((a, b) => a.published.getTime() - b.published.getTime());
    const latest = posts[posts.length - 1];
    const todays = posts.filter((p) => p.dateLabel === latest.dateLabel);

    // 같은 질문은 최신 글 내용으로 덮어씀 ("잠시 후 공개" → 실제 정답 갱신)
    // 단, 이미 실제 정답이 있는데 최신 글이 "잠시 후 공개"면 기존 정답 유지
    const merged = new Map<string, QAItem>();
    for (const post of todays) {
      for (const item of post.items) {
        const key = normalizeQuestion(item.question);
        const existing = merged.get(key);
        if (existing && !existing.pending && item.pending) continue;
        merged.set(key, item);
      }
    }

    result.push({
      app,
      dateLabel: latest.dateLabel,
      updatedAt: latest.published,
      items: Array.from(merged.values()),
    });
  }

  return result;
}
