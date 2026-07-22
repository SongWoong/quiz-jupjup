# 오늘의 퀴즈정답 (quiz-jupjup)

앱테크 퀴즈(캐시워크·신한·캐시닥·KB Pay·OK캐쉬백) 정답을 모아 보여주는 앱인토스 미니앱.

## 구조

```
공개 정답 블로그들 → [수집 봇: GitHub Actions, 1시간 주기] → data/answers.json → 앱이 fetch
                                                              (실패 시 앱이 블로그 피드를 직접 파싱하는 폴백)
```

- `scripts/collect-answers.mjs`: 수집 봇. 소스별 파서(어댑터) 방식이라 소스 추가/교체가 쉽다
- `.github/workflows/collect-answers.yml`: 매시 7분에 봇 실행, 변경 시 자동 커밋
- `data/answers.json`: 봇이 생성하는 정답 데이터 (앱이 raw URL로 읽음)
- `src/`: 앱 (React + Vite + @apps-in-toss/web-framework)

## 명령어

```bash
npm run dev                       # 앱인토스 개발 서버 (granite dev)
node scripts/collect-answers.mjs  # 수집 봇 로컬 실행
npm run build                     # 프로덕션 빌드
```

## 주의

- 토스 행운퀴즈는 앱인토스 심사 리스크 때문에 의도적으로 수집·표시하지 않는다
- GitHub Actions 스케줄은 저장소가 60일간 활동이 없으면 자동 비활성화된다 (봇 커밋이 활동으로 집계되므로 평소엔 문제없음)
- 정답 데이터는 공개 블로그에서 추출한 사실 정보이며, 원문 콘텐츠를 재발행하지 않는다
