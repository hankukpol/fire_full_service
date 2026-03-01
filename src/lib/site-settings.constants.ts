export type SiteSettingKey =
  | "site.title"
  | "site.heroBadge"
  | "site.heroTitle"
  | "site.heroSubtitle"
  | "site.footerDisclaimer"
  | "site.bannerImageUrl"
  | "site.bannerLink"
  | "site.careerExamEnabled"
  | "site.maintenanceMode"
  | "site.maintenanceMessage"
  | "site.mainPageAutoRefresh"
  | "site.mainPageRefreshInterval"
  | "site.mainCardLiveStatsEnabled"
  | "site.mainCardOverviewEnabled"
  | "site.mainCardDifficultyEnabled"
  | "site.mainCardCompetitiveEnabled"
  | "site.mainCardScoreDistributionEnabled"
  | "site.submissionEditLimit"
  | "site.finalPredictionEnabled"
  | "site.autoPassCutEnabled"
  | "site.autoPassCutMode"
  | "site.autoPassCutCheckIntervalSec"
  | "site.autoPassCutThresholdProfile"
  | "site.commentsEnabled"
  | "site.autoPassCutReadyRatioProfile"
  | "site.tabMainEnabled"
  | "site.tabInputEnabled"
  | "site.tabResultEnabled"
  | "site.tabPredictionEnabled"
  | "site.tabNoticesEnabled"
  | "site.tabFaqEnabled"
  | "site.tabLockedMessage"
  | "site.termsOfService"
  | "site.privacyPolicy";

export type SiteSettingValueType = "string" | "nullable-string" | "boolean" | "number";

export type SiteSettingsMap = Record<SiteSettingKey, string | boolean | number | null>;

export const SITE_SETTING_TYPES: Record<SiteSettingKey, SiteSettingValueType> = {
  "site.title": "string",
  "site.heroBadge": "string",
  "site.heroTitle": "string",
  "site.heroSubtitle": "string",
  "site.footerDisclaimer": "string",
  "site.bannerImageUrl": "nullable-string",
  "site.bannerLink": "nullable-string",
  "site.careerExamEnabled": "boolean",
  "site.maintenanceMode": "boolean",
  "site.maintenanceMessage": "string",
  "site.mainPageAutoRefresh": "boolean",
  "site.mainPageRefreshInterval": "string",
  "site.mainCardLiveStatsEnabled": "boolean",
  "site.mainCardOverviewEnabled": "boolean",
  "site.mainCardDifficultyEnabled": "boolean",
  "site.mainCardCompetitiveEnabled": "boolean",
  "site.mainCardScoreDistributionEnabled": "boolean",
  "site.submissionEditLimit": "number",
  "site.commentsEnabled": "boolean",
  "site.finalPredictionEnabled": "boolean",
  "site.autoPassCutEnabled": "boolean",
  "site.autoPassCutMode": "string",
  "site.autoPassCutCheckIntervalSec": "number",
  "site.autoPassCutThresholdProfile": "string",
  "site.autoPassCutReadyRatioProfile": "string",
  "site.tabMainEnabled": "boolean",
  "site.tabInputEnabled": "boolean",
  "site.tabResultEnabled": "boolean",
  "site.tabPredictionEnabled": "boolean",
  "site.tabNoticesEnabled": "boolean",
  "site.tabFaqEnabled": "boolean",
  "site.tabLockedMessage": "string",
  "site.termsOfService": "string",
  "site.privacyPolicy": "string",
};

export const SITE_SETTING_DEFAULTS: SiteSettingsMap = {
  "site.title": "소방 필기 합격예측",
  "site.heroBadge": "2026년 소방공무원 채용시험 합격예측",
  "site.heroTitle": "OMR 입력부터 합격권 예측까지\n한 번에 확인하세요.",
  "site.heroSubtitle":
    "응시정보와 OMR 답안을 입력하면 과목별 분석, 석차, 배수 위치, 합격권 등급을 실시간으로 제공합니다.",
  "site.footerDisclaimer":
    "면책조항: 본 서비스는 수험생의 자기 점검을 위한 참고용 분석 도구이며, 실제 합격 여부를 보장하지 않습니다. 최종 선발 결과는 소방청 및 시·도 소방본부 공식 공고를 반드시 확인해 주세요.",
  "site.bannerImageUrl": null,
  "site.bannerLink": null,
  "site.careerExamEnabled": true,
  "site.maintenanceMode": false,
  "site.maintenanceMessage": "시스템 점검 중입니다.",
  "site.mainPageAutoRefresh": true,
  "site.mainPageRefreshInterval": "60",
  "site.mainCardLiveStatsEnabled": true,
  "site.mainCardOverviewEnabled": true,
  "site.mainCardDifficultyEnabled": true,
  "site.mainCardCompetitiveEnabled": true,
  "site.mainCardScoreDistributionEnabled": true,
  "site.submissionEditLimit": 3,
  "site.commentsEnabled": true,
  "site.finalPredictionEnabled": false,
  "site.autoPassCutEnabled": false,
  "site.autoPassCutMode": "HYBRID",
  "site.autoPassCutCheckIntervalSec": 300,
  "site.autoPassCutThresholdProfile": "BALANCED",
  "site.autoPassCutReadyRatioProfile": "BALANCED",
  "site.tabMainEnabled": true,
  "site.tabInputEnabled": true,
  "site.tabResultEnabled": true,
  "site.tabPredictionEnabled": true,
  "site.tabNoticesEnabled": true,
  "site.tabFaqEnabled": true,
  "site.tabLockedMessage": "시험 후 오픈 예정입니다",
  "site.termsOfService": `제1조 (목적)
본 약관은 소방 필기 합격예측 서비스(이하 "서비스")의 이용 조건 및 절차에 관한 사항을 규정합니다.

제2조 (서비스 내용)
서비스는 응시자가 OMR 답안을 입력하면 예상 점수 및 합격 가능성을 분석하는 참고용 도구입니다.
본 서비스의 분석 결과는 실제 합격 여부를 보장하지 않으며, 최종 결과는 소방청 공식 발표를 따릅니다.

제3조 (회원 의무)
① 회원은 타인의 정보를 도용하거나 허위 정보를 입력해서는 안 됩니다.
② 회원은 서비스를 통해 취득한 정보를 무단으로 복제·배포할 수 없습니다.

제4조 (서비스 변경·중단)
운영자는 서비스의 내용을 변경하거나 일시 중단할 수 있으며, 사전 공지를 원칙으로 합니다.

제5조 (면책 사항)
서비스는 참고용 분석 도구이며, 분석 결과에 의한 손해에 대해 운영자는 책임을 지지 않습니다.`,
  "site.privacyPolicy": `■ 개인정보 수집·이용 동의

1. 수집 항목
   - 필수: 이름, 휴대전화번호, 비밀번호(암호화 저장)
   - 서비스 이용 시: 응시번호, OMR 답안, 지역, 채용유형

2. 수집 목적
   - 회원 식별 및 로그인 인증
   - 성적 분석 및 합격예측 서비스 제공
   - 서비스 운영 및 부정이용 방지

3. 보유 기간
   - 회원 탈퇴 시 즉시 삭제
   - 단, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관

4. 제3자 제공
   - 이용자의 개인정보는 제3자에게 제공하지 않습니다.

5. 동의 거부 권리
   - 위 동의를 거부할 수 있으나, 거부 시 서비스 이용이 불가합니다.`,
};
