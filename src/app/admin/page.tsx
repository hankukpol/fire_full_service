import Link from "next/link";
import DashboardSetupChecklist from "@/components/admin/DashboardSetupChecklist";
import DashboardSubmissionTrendChart from "@/components/admin/DashboardSubmissionTrendChart";
import { prisma } from "@/lib/prisma";

/* ────────────── 통계 카드 스타일 (6개) ────────────── */

const statCardStyles = [
  { label: "text-police-600" },
  { label: "text-rose-600" },
  { label: "text-amber-600" },
  { label: "text-cyan-600" },
  { label: "text-emerald-600" },
  { label: "text-violet-600" },
];

/* ────────────── 빠른 실행 (6개 핵심) ────────────── */

const quickActions = [
  {
    href: "/admin/exams",
    num: "1",
    title: "시험 생성/활성화",
    desc: "신규 시험을 만들고 활성화합니다.",
    color: "text-police-600",
    hoverBg: "hover:border-police-300",
  },
  {
    href: "/admin/answers",
    num: "2",
    title: "정답 입력/저장",
    desc: "OMR 입력 또는 CSV 업로드로 정답을 반영합니다.",
    color: "text-cyan-600",
    hoverBg: "hover:border-cyan-300",
  },
  {
    href: "/admin/regions",
    num: "3",
    title: "모집인원 관리",
    desc: "지역별 공채/경채 선발인원을 설정합니다.",
    color: "text-emerald-600",
    hoverBg: "hover:border-emerald-300",
  },
  {
    href: "/admin/stats",
    num: "4",
    title: "참여 통계",
    desc: "유형/성별/지역 참여 현황을 확인합니다.",
    color: "text-amber-600",
    hoverBg: "hover:border-amber-300",
  },
  {
    href: "/admin/site",
    num: "5",
    title: "사이트 설정",
    desc: "메인 문구, 점검 모드를 관리합니다.",
    color: "text-violet-600",
    hoverBg: "hover:border-violet-300",
  },
  {
    href: "/admin/users",
    num: "6",
    title: "사용자 관리",
    desc: "권한 조정, 비밀번호 초기화를 수행합니다.",
    color: "text-indigo-600",
    hoverBg: "hover:border-indigo-300",
  },
];

/* ────────────── 페이지 ────────────── */

export default async function AdminDashboardPage() {
  let activeExam: { id: number; year: number; round: number; name: string } | null = null;
  let totalExams = 0;
  let totalSubmissions = 0;
  let totalUsers = 0;
  let todaySubmissions = 0;
  let publicCount = 0;
  let careerRescueCount = 0;
  let careerAcademicCount = 0;
  let careerEmtCount = 0;
  let publicAnswerKeyCount = 0;
  let careerRescueAnswerKeyCount = 0;
  let careerAcademicAnswerKeyCount = 0;
  let careerEmtAnswerKeyCount = 0;
  let regionsConfigured = 0;
  let regionsTotal = 0;
  let isMaintenanceMode = false;
  let lastSubmissionAt: Date | null = null;
  let submissionTrend: Array<{ date: string; count: number }> = [];
  let regionBreakdown: Array<{ name: string; publicCount: number; careerRescueCount: number; careerAcademicCount: number; careerEmtCount: number; total: number }> = [];
  let hasStatsError = false;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [dbActiveExam, dbTotalExams, dbTotalUsers] = await prisma.$transaction([
      prisma.exam.findFirst({
        where: { isActive: true },
        orderBy: [{ examDate: "desc" }, { id: "desc" }],
        select: { id: true, year: true, round: true, name: true },
      }),
      prisma.exam.count(),
      prisma.user.count(),
    ]);

    activeExam = dbActiveExam;
    totalExams = dbTotalExams;
    totalUsers = dbTotalUsers;

    if (dbActiveExam) {
      const [
        dbTotalSub,
        dbTodaySub,
        dbExamTypeCounts,
        dbPublicAK,
        dbCareerRescueAK,
        dbCareerAcademicAK,
        dbCareerEmtAK,
        dbRegionsConfigured,
        dbRegionsTotal,
        dbLastSubmission,
      ] = await Promise.all([
        prisma.submission.count({ where: { examId: dbActiveExam.id } }),
        prisma.submission.count({ where: { examId: dbActiveExam.id, createdAt: { gte: todayStart } } }),
        prisma.submission.groupBy({
          by: ["examType"],
          where: { examId: dbActiveExam.id },
          _count: true,
        }),
        prisma.answerKey.count({ where: { examId: dbActiveExam.id, subject: { examType: "PUBLIC" } } }),
        prisma.answerKey.count({ where: { examId: dbActiveExam.id, subject: { examType: "CAREER_RESCUE" } } }),
        prisma.answerKey.count({ where: { examId: dbActiveExam.id, subject: { examType: "CAREER_ACADEMIC" } } }),
        prisma.answerKey.count({ where: { examId: dbActiveExam.id, subject: { examType: "CAREER_EMT" } } }),
        prisma.examRegionQuota.count({ where: { examId: dbActiveExam.id, recruitPublicMale: { gt: 0 } } }),
        prisma.examRegionQuota.count({ where: { examId: dbActiveExam.id } }),
        prisma.submission.findFirst({
          where: { examId: dbActiveExam.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

      totalSubmissions = dbTotalSub;
      todaySubmissions = dbTodaySub;
      for (const row of dbExamTypeCounts) {
        if (row.examType === "PUBLIC") publicCount = row._count;
        if (row.examType === "CAREER_RESCUE") careerRescueCount = row._count;
        if (row.examType === "CAREER_ACADEMIC") careerAcademicCount = row._count;
        if (row.examType === "CAREER_EMT") careerEmtCount = row._count;
      }
      publicAnswerKeyCount = dbPublicAK;
      careerRescueAnswerKeyCount = dbCareerRescueAK;
      careerAcademicAnswerKeyCount = dbCareerAcademicAK;
      careerEmtAnswerKeyCount = dbCareerEmtAK;
      regionsConfigured = dbRegionsConfigured;
      regionsTotal = dbRegionsTotal;
      lastSubmissionAt = dbLastSubmission?.createdAt ?? null;

      // 제출 추이
      const trendRaw = await prisma.$queryRaw<Array<{ date: string; count: bigint | number }>>`
        SELECT
          TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
          COUNT(*)::bigint AS count
        FROM "Submission"
        WHERE "examId" = ${dbActiveExam.id}
        GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        ORDER BY TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      `;
      submissionTrend = trendRaw
        .map((item) => ({ date: item.date, count: Number(item.count) }))
        .filter((item) => Number.isFinite(item.count))
        .slice(-10);

      // 지역별 제출 현황 (상위 5개)
      const regionRaw = await prisma.$queryRaw<
        Array<{ name: string; publicCount: bigint | number; careerRescueCount: bigint | number; careerAcademicCount: bigint | number; careerEmtCount: bigint | number; total: bigint | number }>
      >`
        SELECT
          r."name",
          SUM(CASE WHEN s."examType" = 'PUBLIC' THEN 1 ELSE 0 END)::bigint AS "publicCount",
          SUM(CASE WHEN s."examType" = 'CAREER_RESCUE' THEN 1 ELSE 0 END)::bigint AS "careerRescueCount",
          SUM(CASE WHEN s."examType" = 'CAREER_ACADEMIC' THEN 1 ELSE 0 END)::bigint AS "careerAcademicCount",
          SUM(CASE WHEN s."examType" = 'CAREER_EMT' THEN 1 ELSE 0 END)::bigint AS "careerEmtCount",
          COUNT(*)::bigint AS "total"
        FROM "Submission" s
        JOIN "Region" r ON s."regionId" = r."id"
        WHERE s."examId" = ${dbActiveExam.id}
        GROUP BY r."id", r."name"
        ORDER BY "total" DESC
        LIMIT 5
      `;
      regionBreakdown = regionRaw.map((row) => ({
        name: row.name,
        publicCount: Number(row.publicCount),
        careerRescueCount: Number(row.careerRescueCount),
        careerAcademicCount: Number(row.careerAcademicCount),
        careerEmtCount: Number(row.careerEmtCount),
        total: Number(row.total),
      }));
    }

    // 점검 모드
    const maintenanceSetting = await prisma.siteSetting.findUnique({ where: { key: "maintenanceMode" } });
    isMaintenanceMode = maintenanceSetting?.value === "true";
  } catch (error) {
    console.error("관리자 대시보드 통계 조회 중 오류:", error);
    hasStatsError = true;
  }

  /* ────────── 체크리스트 ────────── */

  const checklistItems = activeExam
    ? [
        { label: "시험 생성 완료", completed: true, href: "/admin/exams" },
        { label: "정답 입력 (공채)", completed: publicAnswerKeyCount >= 75, href: "/admin/answers" },
        { label: "정답 입력 (구조 경채)", completed: careerRescueAnswerKeyCount >= 65, href: "/admin/answers" },
        { label: "정답 입력 (소방학과 경채)", completed: careerAcademicAnswerKeyCount >= 65, href: "/admin/answers" },
        { label: "정답 입력 (구급 경채)", completed: careerEmtAnswerKeyCount >= 65, href: "/admin/answers" },
        { label: "모집인원 설정", completed: regionsConfigured > 0 && regionsConfigured === regionsTotal, href: "/admin/regions" },
        { label: "운영 시작 (점검 모드 해제)", completed: !isMaintenanceMode, href: "/admin/site" },
      ]
    : [{ label: "시험 생성", completed: false, href: "/admin/exams" }];

  /* ────────── 통계 카드 데이터 ────────── */

  const totalPercent = totalSubmissions > 0 ? Math.round((publicCount / totalSubmissions) * 100) : 0;
  const careerTotal = careerRescueCount + careerAcademicCount + careerEmtCount;
  const answerKeyStatus =
    publicAnswerKeyCount >= 75 && careerRescueAnswerKeyCount >= 65 && careerAcademicAnswerKeyCount >= 65 && careerEmtAnswerKeyCount >= 65
      ? "등록 완료"
      : publicAnswerKeyCount + careerRescueAnswerKeyCount + careerAcademicAnswerKeyCount + careerEmtAnswerKeyCount > 0
        ? "일부 등록"
        : "미등록";

  const stats = [
    {
      label: "활성 시험",
      value: activeExam ? `${activeExam.year}년 ${activeExam.round}차` : "없음",
      sub: activeExam?.name ?? "활성화된 시험 없음",
    },
    {
      label: "총 제출 수",
      value: totalSubmissions.toLocaleString(),
      sub: `회원 수: ${totalUsers.toLocaleString()}`,
    },
    {
      label: "오늘 제출",
      value: todaySubmissions.toLocaleString(),
      sub: new Date().toLocaleDateString("ko-KR"),
    },
    {
      label: "공채 / 경채",
      value: totalSubmissions > 0 ? `${totalPercent}% / ${100 - totalPercent}%` : "-",
      sub: `공채 ${publicCount}명 / 경채 ${careerTotal}명 (구조${careerRescueCount}/학과${careerAcademicCount}/구급${careerEmtCount})`,
    },
    {
      label: "정답키 상태",
      value: answerKeyStatus,
      sub: `공채 ${publicAnswerKeyCount} / 구조 ${careerRescueAnswerKeyCount} / 학과 ${careerAcademicAnswerKeyCount} / 구급 ${careerEmtAnswerKeyCount}문항`,
    },
    {
      label: "등록 시험 수",
      value: String(totalExams),
      sub: "전체 시험",
    },
  ];

  /* ────────── 시스템 상태 ────────── */

  function formatRelativeTime(date: Date | null): string {
    if (!date) return "-";
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  }

  const systemStatus = [
    {
      label: "정답키 (공채)",
      ok: publicAnswerKeyCount >= 75,
      value: publicAnswerKeyCount >= 75 ? `${publicAnswerKeyCount}문항 등록` : `${publicAnswerKeyCount}문항 (미완료)`,
    },
    {
      label: "정답키 (구조 경채)",
      ok: careerRescueAnswerKeyCount >= 65,
      value: careerRescueAnswerKeyCount >= 65 ? `${careerRescueAnswerKeyCount}문항 등록` : `${careerRescueAnswerKeyCount}문항 (미완료)`,
    },
    {
      label: "정답키 (소방학과 경채)",
      ok: careerAcademicAnswerKeyCount >= 65,
      value: careerAcademicAnswerKeyCount >= 65 ? `${careerAcademicAnswerKeyCount}문항 등록` : `${careerAcademicAnswerKeyCount}문항 (미완료)`,
    },
    {
      label: "정답키 (구급 경채)",
      ok: careerEmtAnswerKeyCount >= 65,
      value: careerEmtAnswerKeyCount >= 65 ? `${careerEmtAnswerKeyCount}문항 등록` : `${careerEmtAnswerKeyCount}문항 (미완료)`,
    },
    {
      label: "모집인원 설정",
      ok: regionsConfigured > 0 && regionsConfigured === regionsTotal,
      value: regionsTotal > 0 ? `${regionsConfigured}/${regionsTotal}개 지역` : "설정 없음",
    },
    {
      label: "서비스 상태",
      ok: !isMaintenanceMode,
      value: isMaintenanceMode ? "점검 모드" : "운영 중",
    },
    {
      label: "마지막 제출",
      ok: true,
      value: formatRelativeTime(lastSubmissionAt),
    },
  ];

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header>
        <h1 className="text-xl font-bold text-slate-900">관리자 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          시험 생성, 정답 입력, 전체 재채점까지 한 흐름으로 운영할 수 있습니다.
        </p>
      </header>

      {/* 경고 알림 */}
      {hasStatsError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          통계 데이터를 불러오지 못했습니다. 데이터베이스 연결 상태를 확인해 주세요.
        </div>
      ) : null}

      {/* 운영 체크리스트 */}
      {!hasStatsError ? <DashboardSetupChecklist items={checklistItems} /> : null}

      {/* 통계 카드 (6개) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat, index) => {
          const style = statCardStyles[index % statCardStyles.length];
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <p className={`text-xs font-bold uppercase tracking-wider ${style.label}`}>
                {stat.label}
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 xl:text-3xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      {/* 차트 + 시스템 상태 */}
      {!hasStatsError ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          {/* 제출 추이 차트 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">최근 제출 추이</h2>
              <span className="rounded-full bg-police-50 px-3 py-1 text-xs font-medium text-police-600">
                최근 10일
              </span>
            </div>
            <DashboardSubmissionTrendChart data={submissionTrend} />
          </div>

          {/* 시스템 상태 */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">시스템 상태</h3>
              <div className="mt-4 space-y-3">
                {systemStatus.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className={`text-xs font-semibold ${item.ok ? "text-emerald-600" : "text-amber-600"}`}>
                      {item.ok ? "\u2705" : "\u26A0\uFE0F"} {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {activeExam ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">활성 시험</h3>
                <p className="mt-3 text-lg font-bold text-slate-900">
                  {activeExam.year}년 {activeExam.round}차
                </p>
                <p className="mt-1 text-xs text-slate-500">{activeExam.name}</p>
                <Link
                  href="/admin/exams"
                  className="mt-3 inline-block rounded-lg bg-police-50 px-3 py-1.5 text-xs font-medium text-police-600 transition hover:bg-police-100"
                >
                  시험 관리
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 지역별 제출 현황 */}
      {!hasStatsError && regionBreakdown.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">지역별 제출 현황 (상위 5개)</h2>
            <Link
              href="/admin/stats"
              className="text-xs font-medium text-police-600 hover:text-police-700"
            >
              전체 보기
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                  <th className="pb-2 pr-4">지역</th>
                  <th className="pb-2 pr-4 text-right">공채</th>
                  <th className="pb-2 pr-4 text-right">구조</th>
                  <th className="pb-2 pr-4 text-right">소방학과</th>
                  <th className="pb-2 pr-4 text-right">구급</th>
                  <th className="pb-2 text-right">합계</th>
                </tr>
              </thead>
              <tbody>
                {regionBreakdown.map((row) => (
                  <tr key={row.name} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-700">{row.name}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{row.publicCount}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{row.careerRescueCount}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{row.careerAcademicCount}</td>
                    <td className="py-2 pr-4 text-right text-slate-600">{row.careerEmtCount}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 빠른 실행 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800">빠른 실행</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md ${action.hoverBg}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold ${action.color} transition group-hover:bg-slate-200`}
                >
                  {action.num}
                </span>
                <p className="text-sm font-semibold text-slate-800">{action.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
