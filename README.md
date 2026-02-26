# Fire Exam Prediction (소방 합격예측)

Next.js + Prisma 기반 소방공무원 채용시험 합격예측 서비스입니다.
배포 기준: `Vercel + Supabase(PostgreSQL + Storage)`

## 소방 시험 개요

- **시험명**: 2026년 소방공무원 채용시험
- **채용유형**: 공채 / 구조·학과 경채 / 구급 경채 (3종)
- **공채**: 소방학개론(25) + 소방관계법규(25) + 행정법총론(25) = 75문항, 300점 만점
- **구조·학과 경채**: 소방학개론(25) + 소방관계법규(40) = 65문항, 200점 만점
- **구급 경채**: 소방학개론(25) + 응급처치학개론(40) = 65문항, 200점 만점
- **공채는 남녀 분리 선발** (경채는 통합)
- **과락**: 과목별 40% 미만 + 총점 60% 미만 (2중 과락)

## Local Setup

1. 환경변수 파일 생성
```bash
cp .env.example .env
```

2. 의존성 설치
```bash
npm install
```

3. Prisma 클라이언트 생성 및 스키마 반영
```bash
npm run prisma:generate
npm run prisma:push
```

4. 시드 데이터 입력(선택)
```bash
npm run prisma:seed
```

5. 개발 서버 실행
```bash
npm run dev
```
- 개발 서버: `http://localhost:3200`

## Required Environment Variables

- `DATABASE_URL`: Supabase Postgres 연결 문자열 (소방 전용 DB)
- `NEXTAUTH_SECRET`: NextAuth JWT 서명 키
- `NEXTAUTH_URL`: 서비스 URL
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_URL`: 서버용 Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Storage 업로드/삭제용 키(서버 전용)
- `SUPABASE_STORAGE_BUCKET`: Storage 버킷명(기본 `uploads`)
- `CRON_SECRET` 또는 `AUTO_PASSCUT_CRON_SECRET`: 자동 발표 크론 인증 키

## Vercel Deploy

1. Vercel에 소방 전용 프로젝트 생성 및 저장소 연결
2. 위 환경변수 등록 (경찰과 별도 Supabase 프로젝트 사용)
3. Supabase에서 `uploads` 버킷(공개 버킷) 생성
4. 배포 후 크론 인증 동작 확인

## Notes

- 경찰(`police/`)과 소방(`fire/`)은 별도 Vercel 프로젝트 + 별도 Supabase DB로 운영
- 파일 업로드는 Supabase Storage 사용
- `prisma db push` 방식으로 스키마 반영
