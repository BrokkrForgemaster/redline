export const RETENTION_CLASSES = {
  approvedServiceRecord: { days: 365 * 7 },
  routineEvidencePhoto: { days: 365 * 7 },
  serviceGpsEvent: { days: 365 * 7 },
  continuousBreadcrumb: { days: 180 },
  dailyRouteSummary: { days: 365 * 2 },
  auditEvent: { days: 365 * 7 },
  authSecurityLog: { days: 180 },
  invalidPushSubscription: { days: 30 },
  orphanDraft: { days: 30 },
  tempFailedUpload: { days: 7 },
  softDeletedMediaQuarantine: { days: 30 },
} as const;

export type RetentionClass = keyof typeof RETENTION_CLASSES;

export interface RetentionEligibilityInput {
  retentionClass: RetentionClass;
  createdAt: Date;
  now: Date;
  hasLegalHold?: boolean;
  parentRetainedUntil?: Date | null;
}

export function isRetentionEligible(input: RetentionEligibilityInput) {
  if (input.hasLegalHold) return false;
  if (input.parentRetainedUntil && input.parentRetainedUntil > input.now) return false;

  const retentionDays = RETENTION_CLASSES[input.retentionClass].days;
  const ageMs = input.now.getTime() - input.createdAt.getTime();
  return ageMs >= retentionDays * 24 * 60 * 60 * 1000;
}
