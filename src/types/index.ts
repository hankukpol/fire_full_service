import type { BonusType, ExamType, Gender, Role } from "@prisma/client";

export type UserRole = Role;
export type RecruitExamType = ExamType;
export type UserGender = Gender;
export type BonusCategory = BonusType;

export interface RegionRecruitInfo {
  name: string;
  recruitPublicMale: number;
  recruitPublicFemale: number;
  recruitRescue: number;           // 구조 (남자만)
  recruitAcademicMale: number;     // 소방학과 남
  recruitAcademicFemale: number;   // 소방학과 여
  recruitAcademicCombined: number; // 소방학과 양성
  recruitEmtMale: number;          // 구급 남
  recruitEmtFemale: number;        // 구급 여
}

export interface SubjectDefinition {
  name: string;
  examType: ExamType;
  questionCount: number;
  pointPerQuestion: number;
  maxScore: number;
}

export interface RegisterFormData {
  name: string;
  email?: string;
  phone: string;
  password: string;
  agreedToTerms: boolean;    // 서비스 이용약관 동의 (필수)
  agreedToPrivacy: boolean;  // 개인정보 수집·이용 동의 (필수)
}

export interface LoginFormData {
  phone: string;
  password: string;
}

export interface ScoringSummary {
  totalRawScore: number;
  bonusScore: number;
  finalScore: number;
  isFailed: boolean;
  isTotalCutoff: boolean; // 소방: 총점 60% 미만 과락
}
