// 정답 데이터 소스 설정
// 1순위: 수집 봇이 1시간마다 갱신하는 JSON (GitHub Actions)
// 2순위(폴백): 블로그 피드 직접 파싱
export const BOT_DATA_URL =
  "https://raw.githubusercontent.com/SongWoong/quiz-jupjup/main/data/answers.json";

// 폴백용 블로그. 나중에 본인 블로그로 바꾸려면 이 한 줄만 수정하면 됩니다.
export const SOURCE_BLOG = "https://oneuljupjup.blogspot.com";

// 피드에서 한 번에 가져올 글 수 (하루치 커버에 충분한 양)
export const FEED_MAX_RESULTS = 40;

export interface QuizApp {
  id: string;
  /** 화면에 보여줄 이름 */
  label: string;
  /** 글 제목에서 이 퀴즈 앱을 식별하는 키워드들 */
  keywords: string[];
  /** 카드 포인트 색 */
  color: string;
  emoji: string;
}

// 토스 행운퀴즈는 심사 리스크(토스 자체 서비스 정답 유출)로 의도적으로 제외
export const QUIZ_APPS: QuizApp[] = [
  {
    id: "cashwalk",
    label: "캐시워크",
    keywords: ["캐시워크", "돈버는퀴즈"],
    color: "#f04452",
    emoji: "👟",
  },
  {
    id: "shinhan",
    label: "신한",
    keywords: ["신한"],
    color: "#0046ff",
    emoji: "🏦",
  },
  {
    id: "cashdoc",
    label: "캐시닥",
    keywords: ["캐시닥", "타임스프레드", "용돈퀴즈"],
    color: "#ff8a00",
    emoji: "💊",
  },
  {
    id: "kbpay",
    label: "KB Pay",
    keywords: ["KB Pay", "KB페이", "kb pay"],
    color: "#5f6f52",
    emoji: "💳",
  },
  {
    id: "okcashbag",
    label: "OK캐쉬백",
    keywords: ["OK캐쉬백", "오퀴즈", "ok캐쉬백"],
    color: "#7c3aed",
    emoji: "🅾️",
  },
];

/** 제외할 키워드: 이 단어가 제목에 있으면 무시 */
export const EXCLUDED_KEYWORDS = ["토스", "행운퀴즈"];
