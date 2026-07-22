import { useCallback, useEffect, useRef, useState } from "react";
import { loadAnswers, type AppAnswers } from "./lib/feed";
import { QUIZ_APPS } from "./lib/config";

type Status = "loading" | "ready" | "error";

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${m}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [groups, setGroups] = useState<AppAnswers[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await loadAnswers();
      setGroups(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }, []);

  const handleCopy = useCallback(
    async (answer: string) => {
      const ok = await copyText(answer);
      showToast(ok ? "정답을 복사했어요" : "복사에 실패했어요");
    },
    [showToast]
  );

  const visible =
    filter === "all" ? groups : groups.filter((g) => g.app.id === filter);

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일`;

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">오늘의 퀴즈정답</h1>
        <p className="subtitle">{dateLabel} 앱테크 퀴즈 정답 모음</p>
      </header>

      {status === "ready" && groups.length > 0 && (
        <nav className="chips" aria-label="퀴즈 앱 선택">
          <button
            className={`chip ${filter === "all" ? "chip-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            전체
          </button>
          {QUIZ_APPS.filter((a) => groups.some((g) => g.app.id === a.id)).map(
            (a) => (
              <button
                key={a.id}
                className={`chip ${filter === a.id ? "chip-active" : ""}`}
                onClick={() => setFilter(a.id)}
              >
                {a.emoji} {a.label}
              </button>
            )
          )}
        </nav>
      )}

      {status === "loading" && (
        <div className="state-box">
          <div className="spinner" aria-hidden />
          <p>오늘의 정답을 불러오는 중...</p>
        </div>
      )}

      {status === "error" && (
        <div className="state-box">
          <p>정답을 불러오지 못했어요.</p>
          <button className="retry-btn" onClick={load}>
            다시 시도
          </button>
        </div>
      )}

      {status === "ready" && visible.length === 0 && (
        <div className="state-box">
          <p>아직 올라온 정답이 없어요.</p>
          <button className="retry-btn" onClick={load}>
            새로고침
          </button>
        </div>
      )}

      {status === "ready" &&
        visible.map((group) => (
          <section key={group.app.id} className="group">
            <div className="group-head">
              <h2 className="group-title">
                <span
                  className="group-dot"
                  style={{ background: group.app.color }}
                  aria-hidden
                />
                {group.app.emoji} {group.app.label}
                {group.dateLabel && (
                  <span className="group-date">{group.dateLabel}</span>
                )}
              </h2>
              <span className="group-time">
                {formatTime(group.updatedAt)} 갱신
              </span>
            </div>

            {group.items.map((item, i) => (
              <article key={i} className="qa-card">
                <p className="qa-question">
                  <span className="qa-badge">Q{i + 1}</span>
                  {item.question}
                </p>
                <div className="qa-answer-row">
                  {item.pending ? (
                    <span className="qa-answer qa-pending">
                      ⏳ 잠시 후 공개
                    </span>
                  ) : (
                    <>
                      <span
                        className="qa-answer"
                        style={{ color: group.app.color }}
                      >
                        {item.answer}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => handleCopy(item.answer)}
                      >
                        복사
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </section>
        ))}

      {status === "ready" && (
        <footer className="footer">
          <button className="refresh-btn" onClick={load}>
            🔄 정답 새로고침
          </button>
          <p className="disclaimer">
            정답은 실시간으로 바뀔 수 있어요. 참고용으로만 이용해 주세요.
            <br />본 앱은 각 퀴즈 운영사와 무관한 정보 제공 서비스입니다.
          </p>
        </footer>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
