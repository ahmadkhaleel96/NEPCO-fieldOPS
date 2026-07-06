import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ReportData } from '@fieldops/shared';

const BLACK = rgb(0, 0, 0);
const GREY  = rgb(0.5, 0.5, 0.5);
const DARK  = rgb(0.2, 0.2, 0.2);

export async function generateReportPdf(report: {
  id: string;
  cadence: string;
  period_start: string;
  period_end: string;
  data: ReportData;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595, 842]); // A4 portrait
  const { width, height } = page.getSize();
  const ml = 50;  // margin left
  const c2 = 310; // second column
  let y = height - 50;

  function txt(str: string, x: number, yPos: number, size: number, bold = false) {
    page.drawText(str, { x, y: yPos, size, font: bold ? boldFont : font, color: BLACK });
  }

  // ── Title ──────────────────────────────────────────────────────────────────
  txt('NEPCO FieldOps', ml, y, 18, true);
  y -= 22;
  txt('Operational Report', ml, y, 18, true);
  y -= 36;

  // ── Period metadata ────────────────────────────────────────────────────────
  const amman = { timeZone: 'Asia/Amman' } as const;
  const start = new Date(report.period_start).toLocaleDateString('en-JO', amman);
  const end   = new Date(report.period_end).toLocaleDateString('en-JO', amman);
  txt(`Cadence: ${report.cadence.replace(/_/g, ' ')}`, ml, y, 11);
  txt(`Period:  ${start}  –  ${end}`,                   c2, y, 11);
  y -= 8;
  page.drawLine({ start: { x: ml, y }, end: { x: width - ml, y }, thickness: 0.5, color: DARK });
  y -= 22;

  // ── Summary ────────────────────────────────────────────────────────────────
  txt('Summary', ml, y, 12, true);
  y -= 20;

  const { summary } = report.data;
  const rows: [string, string, string, string][] = [
    ['Total Permits',     String(summary.total_permits),     'Total Trips',       String(summary.total_trips)],
    ['Completed Permits', String(summary.completed_permits), 'Total Inspections', String(summary.total_inspections)],
    ['Incomplete Permits',String(summary.incomplete_permits),'Approved Changes',  String(summary.approved_changes)],
    ['Suspended Permits', String(summary.suspended_permits), 'Rejected Changes',  String(summary.rejected_changes)],
    ['Safety Reports',    String(summary.safety_reports),    'NFC Events',        String(summary.total_nfc_events)],
  ];

  for (const [l1, v1, l2, v2] of rows) {
    txt(`${l1}:`, ml,        y, 10);
    txt(v1,       ml + 140,  y, 10, true);
    txt(`${l2}:`, c2,        y, 10);
    txt(v2,       c2 + 140,  y, 10, true);
    y -= 16;
  }
  y -= 10;

  // ── By asset type ──────────────────────────────────────────────────────────
  if (report.data.by_asset_type.length > 0) {
    txt('By Asset Type', ml, y, 12, true);
    y -= 18;
    txt('Asset Type',   ml,       y, 10, true);
    txt('Inspections',  ml + 180, y, 10, true);
    txt('Changes',      ml + 280, y, 10, true);
    y -= 14;

    for (const entry of report.data.by_asset_type) {
      if (y < 100) break;
      txt(entry.asset_type.replace(/_/g, ' '), ml,       y, 10);
      txt(String(entry.inspection_count),       ml + 180, y, 10);
      txt(String(entry.change_count),           ml + 280, y, 10);
      y -= 14;
    }
    y -= 10;
  }

  // ── By engineer ────────────────────────────────────────────────────────────
  if (report.data.by_engineer.length > 0 && y > 120) {
    txt('By Engineer', ml, y, 12, true);
    y -= 18;
    txt('Engineer ID', ml,       y, 10, true);
    txt('Permits',     ml + 280, y, 10, true);
    txt('Approvals',   ml + 360, y, 10, true);
    y -= 14;

    for (const entry of report.data.by_engineer) {
      if (y < 100) break;
      txt(entry.engineer_id,           ml,       y, 10);
      txt(String(entry.permit_count),  ml + 280, y, 10);
      txt(String(entry.approval_count),ml + 360, y, 10);
      y -= 14;
    }
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const generated = new Date().toLocaleString('en-JO', amman);
  page.drawText(
    `Report ID: ${report.id}  ·  Generated: ${generated}`,
    { x: ml, y: 28, size: 7, font, color: GREY }
  );

  return pdfDoc.save();
}
