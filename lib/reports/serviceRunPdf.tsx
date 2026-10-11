import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

export interface ServiceRunPdfData {
  workOrderNumber: string;
  title: string;
  customerName: string;
  address: string;
  workerName: string;
  startedAt: string | null;
  finishedAt: string | null;
  submittedAt: string | null;
  approvedAt: string;
  approvedByName: string;
  instructions: string | null;
  beforeCount: number;
  afterCount: number;
  locationEvents: Array<{
    event_type: string;
    result: string;
    distance_meters: number | null;
    configured_radius_meters: number | null;
    accuracy_meters: number | null;
    override_reason: string | null;
    captured_at_device: string;
  }>;
  notes: Array<{ body: string; note_type: string; authorName: string; created_at: string }>;
  serviceRunId: string;
  generatedAt: string;
}

const RED = "#CC1C1C";
const CHARCOAL = "#1a1a1a";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const GREEN = "#15803d";

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 9, color: CHARCOAL, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: RED },
  brandName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: RED },
  brandSub: { fontSize: 8, color: MUTED, marginTop: 2 },
  reportTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "right" },
  reportSubtitle: { fontSize: 8, color: MUTED, textAlign: "right", marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 120, color: MUTED, fontSize: 8 },
  value: { flex: 1, fontSize: 9 },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontSize: 7, fontFamily: "Helvetica-Bold" },
  pillGreen: { backgroundColor: "#dcfce7", color: GREEN },
  pillRed: { backgroundColor: "#fee2e2", color: RED },
  pillAmber: { backgroundColor: "#fef3c7", color: "#92400e" },
  pillBlue: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  pillGray: { backgroundColor: "#f3f4f6", color: MUTED },
  locationRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  locationBadge: { width: 56, marginRight: 8 },
  locationDetail: { flex: 1 },
  noteRow: { marginBottom: 8, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  noteMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  noteAuthor: { fontSize: 7, color: MUTED },
  noteBody: { fontSize: 9 },
  approvalBox: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#86efac", borderRadius: 4, padding: 12, marginBottom: 16 },
  approvalTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 6 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 8 },
  footerText: { fontSize: 7, color: MUTED },
});

function geofenceResultPill(result: string) {
  if (result === "on_site") return <Text style={[s.pill, s.pillGreen]}>On Site</Text>;
  if (result === "near") return <Text style={[s.pill, s.pillAmber]}>Near</Text>;
  if (result === "outside") return <Text style={[s.pill, s.pillRed]}>Outside</Text>;
  if (result === "override_approved") return <Text style={[s.pill, s.pillBlue]}>Override</Text>;
  return <Text style={[s.pill, s.pillGray]}>{result}</Text>;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }) + " UTC";
}

function fmtShort(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function duration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return "—";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ServiceRunDocument({ data }: { data: ServiceRunPdfData }) {
  const startEvent = data.locationEvents.find((e) => e.event_type === "start" || e.event_type === "override");
  const finishEvent = [...data.locationEvents].reverse().find((e) => e.event_type === "finish" || e.event_type === "override");
  const overrides = data.locationEvents.filter((e) => e.event_type === "override");

  return (
    <Document title={`Service Report — ${data.workOrderNumber}`} author="Redline Landscaping">
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>REDLINE LANDSCAPING</Text>
            <Text style={s.brandSub}>Service Completion Report</Text>
          </View>
          <View>
            <Text style={s.reportTitle}>#{data.workOrderNumber}</Text>
            <Text style={s.reportSubtitle}>Generated {fmtShort(data.generatedAt)}</Text>
          </View>
        </View>

        {/* Approval banner */}
        <View style={s.approvalBox}>
          <Text style={s.approvalTitle}>✓ Approved</Text>
          <View style={s.row}>
            <Text style={s.label}>Approved by</Text>
            <Text style={s.value}>{data.approvedByName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Approved on</Text>
            <Text style={s.value}>{fmt(data.approvedAt)}</Text>
          </View>
        </View>

        {/* Job info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Job Details</Text>
          <View style={s.row}>
            <Text style={s.label}>Job title</Text>
            <Text style={s.value}>{data.title}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Customer</Text>
            <Text style={s.value}>{data.customerName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Property</Text>
            <Text style={s.value}>{data.address}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Assigned worker</Text>
            <Text style={s.value}>{data.workerName}</Text>
          </View>
        </View>

        {/* Time on site */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Time on Site</Text>
          <View style={s.row}>
            <Text style={s.label}>Started</Text>
            <Text style={s.value}>{fmt(data.startedAt)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Finished</Text>
            <Text style={s.value}>{fmt(data.finishedAt)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Duration</Text>
            <Text style={s.value}>{duration(data.startedAt, data.finishedAt)}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Submitted</Text>
            <Text style={s.value}>{fmt(data.submittedAt)}</Text>
          </View>
        </View>

        {/* Location verification */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Location Verification</Text>
          {startEvent && (
            <View style={s.locationRow}>
              <View style={s.locationBadge}>
                <Text style={{ fontSize: 7, color: MUTED, marginBottom: 2 }}>Start</Text>
                {geofenceResultPill(startEvent.result)}
              </View>
              <View style={s.locationDetail}>
                {startEvent.distance_meters != null && (
                  <Text style={{ fontSize: 8 }}>
                    {Math.round(startEvent.distance_meters)}m from site
                    {startEvent.configured_radius_meters != null
                      ? ` (radius ${Math.round(startEvent.configured_radius_meters)}m)`
                      : ""}
                  </Text>
                )}
                {startEvent.override_reason && (
                  <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>
                    Override: {startEvent.override_reason}
                  </Text>
                )}
              </View>
            </View>
          )}
          {finishEvent && finishEvent !== startEvent && (
            <View style={s.locationRow}>
              <View style={s.locationBadge}>
                <Text style={{ fontSize: 7, color: MUTED, marginBottom: 2 }}>Finish</Text>
                {geofenceResultPill(finishEvent.result)}
              </View>
              <View style={s.locationDetail}>
                {finishEvent.distance_meters != null && (
                  <Text style={{ fontSize: 8 }}>
                    {Math.round(finishEvent.distance_meters)}m from site
                    {finishEvent.configured_radius_meters != null
                      ? ` (radius ${Math.round(finishEvent.configured_radius_meters)}m)`
                      : ""}
                  </Text>
                )}
                {finishEvent.override_reason && (
                  <Text style={{ fontSize: 7, color: MUTED, marginTop: 2 }}>
                    Override: {finishEvent.override_reason}
                  </Text>
                )}
              </View>
            </View>
          )}
          {overrides.length > 0 && (
            <View style={s.row}>
              <Text style={s.label}>Location overrides</Text>
              <Text style={s.value}>{overrides.length}</Text>
            </View>
          )}
          {data.locationEvents.length === 0 && (
            <Text style={{ fontSize: 8, color: MUTED }}>No location events recorded.</Text>
          )}
        </View>

        {/* Photo evidence */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Photo Evidence</Text>
          <View style={s.row}>
            <Text style={s.label}>Before photos</Text>
            <Text style={s.value}>{data.beforeCount}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>After photos</Text>
            <Text style={s.value}>{data.afterCount}</Text>
          </View>
          <Text style={{ fontSize: 7, color: MUTED, marginTop: 4 }}>
            Photos are stored securely and available in the Redline admin portal.
          </Text>
        </View>

        {/* Instructions */}
        {data.instructions && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Work Order Instructions</Text>
            <Text style={{ fontSize: 9 }}>{data.instructions}</Text>
          </View>
        )}

        {/* Field notes */}
        {data.notes.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Field Notes</Text>
            {data.notes.map((note, i) => (
              <View key={i} style={s.noteRow}>
                <View style={s.noteMeta}>
                  <Text style={s.noteAuthor}>{note.authorName}</Text>
                  <Text style={s.noteAuthor}>{fmtShort(note.created_at)}</Text>
                </View>
                <Text style={s.noteBody}>{note.body}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Redline Landscaping &amp; Snow Removal</Text>
          <Text style={s.footerText}>Run ID: {data.serviceRunId}</Text>
          <Text style={s.footerText}>{fmtShort(data.generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderServiceRunPdf(data: ServiceRunPdfData): Promise<Buffer> {
  return renderToBuffer(<ServiceRunDocument data={data} />);
}
