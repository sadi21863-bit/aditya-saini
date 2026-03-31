export type AuditStatus = "verified" | "flagged";

export interface AuditMetadata {
  scanned: boolean;
  riskScore: number;
  lastAudit: string;
  status: AuditStatus;
  scanVersion: string;
  isMockScore?: boolean;
  manualOverride?: boolean;
  overrideTimestamp?: string;
  adminNote?: string;
}

// v13: domain-aware report types
// plagiarism is ONLY valid on private ideas
// public ideas reject plagiarism reports at API level (400)
export type PrivateReportType =
  | "plagiarism"
  | "vulgar_inappropriate"
  | "political"
  | "opinion_not_idea";

export type PublicReportType =
  | "vulgar_inappropriate"
  | "political"
  | "opinion_not_idea";

export type ReportType = PrivateReportType | PublicReportType;

export const PRIVATE_REPORT_TYPES: PrivateReportType[] = [
  "plagiarism",
  "vulgar_inappropriate",
  "political",
  "opinion_not_idea",
];

export const PUBLIC_REPORT_TYPES: PublicReportType[] = [
  "vulgar_inappropriate",
  "political",
  "opinion_not_idea",
];

// Admin action types for moderation panel
export type AdminAction = "dismiss" | "warn_user" | "remove_idea" | "ban_user";
