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
  | "site.tabLockedMessage";

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
};
