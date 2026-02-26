# 소방 합격예측 프로그램 (`fire/`)

Next.js + Prisma 기반 소방공무원 채용시험 합격예측 서비스.
경찰 프로젝트(`police/`)와 **완전히 분리된** 독립 프로젝트입니다.

- **로컬 서버**: http://localhost:3200
- **DB**: Supabase `iqhkmcxeuwueiqopkwfd` (서울)
- **관리자**: `010-0000-0000` / `Admin2026!`

---

## 빠른 시작

```bash
# Windows: dev-start.bat 더블클릭
# 또는:
cd fire
npm run dev
```

---

## 채용유형 4종

| ExamType | 한글명 | 성별 | 문항 | 만점 |
|----------|--------|------|------|------|
| `PUBLIC` | 공채 | 남/여 분리 | 75문항 | 300점 |
| `CAREER_RESCUE` | 구조 경채 | 남자만 | 65문항 | 200점 |
| `CAREER_ACADEMIC` | 소방학과 경채 | 지역마다 남/여/양성 | 65문항 | 200점 |
| `CAREER_EMT` | 구급 경채 | 남/여 분리 | 65문항 | 200점 |

---

## 개발 문서

| 문서 | 내용 |
|------|------|
| [00_소방시험_전체구조_이해.md](./docs/00_소방시험_전체구조_이해.md) | **필독** — 시험 구조, 합격배수, 과락, 가산점, 서비스 흐름 전체 |
| [01_소방_프로젝트_개요.md](./docs/01_소방_프로젝트_개요.md) | 프로젝트 구조, 기술스택, 경찰과의 차이점 |
| [02_시험규정_채점로직.md](./docs/02_시험규정_채점로직.md) | 과목/배점/과락/합격배수/가산점 상세 규정 |
| [03_DB_스키마_및_데이터모델.md](./docs/03_DB_스키마_및_데이터모델.md) | Prisma 스키마, 테이블/필드 설명 |
| [04_핵심변경사항_경찰to소방.md](./docs/04_핵심변경사항_경찰to소방.md) | 경찰→소방 변환 내용, 수정 파일 목록, 주의사항 |
| [05_개발환경_설정_가이드.md](./docs/05_개발환경_설정_가이드.md) | 로컬 실행, DB 설정, 트러블슈팅 |
| [DEPLOY_VERCEL_SUPABASE.md](./docs/DEPLOY_VERCEL_SUPABASE.md) | Vercel + Supabase 배포 가이드 |

---

## 핵심 파일

```
src/lib/scoring.ts        # 채점 엔진
src/lib/prediction.ts     # 합격예측 엔진
src/lib/policy.ts         # 소방 정책 상수 (과락율, 가산점 등)
prisma/schema.prisma      # DB 스키마
prisma/seed.ts            # 초기 데이터
```
