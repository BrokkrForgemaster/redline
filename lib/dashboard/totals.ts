export function parseOwnerDashboardTotals(
  row: { active_jobs?: unknown; open_work_orders?: unknown } | null | undefined,
  failed: boolean,
) {
  const activeJobs = Number(row?.active_jobs);
  const openWorkOrders = Number(row?.open_work_orders);
  if (failed || !row || row.active_jobs == null || row.open_work_orders == null ||
      !Number.isFinite(activeJobs) || !Number.isFinite(openWorkOrders)) {
    return { activeJobCount: null, openWorkOrderCount: null, totalsUnavailable: true };
  }
  return { activeJobCount: activeJobs, openWorkOrderCount: openWorkOrders, totalsUnavailable: false };
}
