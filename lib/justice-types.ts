export type AuditStatus = "verified" | "flagged";

export interface AuditMetadata {
    scanned: boolean;
    riskScore: number;
    lastAudit: string;
    status: AuditStatus;
    scanVersion: string;
    isMockScore?: boolean;
}
