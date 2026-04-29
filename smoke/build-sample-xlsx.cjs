/**
 * Build smoke/sample-import.xlsx exercising the round-trip features:
 *   - Plain text cells
 *   - Rich-text runs in a single cell (bold + italic spans)
 *   - Hyperlink cell
 *   - Numeric + formula cells (should be IGNORED by extraction)
 *   - Multiple sheets
 *
 * Run: node smoke/build-sample-xlsx.cjs
 */
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Cethos smoke";

  const s1 = wb.addWorksheet("Q2 Report");
  s1.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Q1 2026", key: "q1", width: 14 },
    { header: "Q2 2026", key: "q2", width: 14 },
    { header: "Comment", key: "comment", width: 60 },
  ];

  s1.addRow({ metric: "Revenue", q1: 2_100_000, q2: 2_450_000, comment: "Strong growth driven by enterprise contracts." });
  s1.addRow({ metric: "Active users", q1: 18_420, q2: 21_990, comment: "Above plan." });
  s1.addRow({ metric: "Churn rate", q1: 0.042, q2: 0.036, comment: "Best quarter on record." });
  s1.addRow({ metric: "Net retention", q1: 1.08, q2: 1.12, comment: "Crossed 110% for the first time." });

  // Rich-text cell on a separate row.
  s1.getCell("A6").value = {
    richText: [
      { text: "Highlight: " },
      { text: "Customer satisfaction reached an all-time high", font: { bold: true } },
      { text: " " },
      { text: "(4.6/5)", font: { italic: true } },
      { text: " across the surveyed cohort." },
    ],
  };
  s1.mergeCells("A6:D6");

  // Hyperlink cell.
  s1.getCell("A7").value = {
    text: "See the full dashboard",
    hyperlink: "https://example.com/dashboard",
  };

  // Formula (should be skipped — no translatable text).
  s1.getCell("C8").value = { formula: "SUM(C2:C5)", result: 1.12 + 0.036 + 21990 + 2450000 };

  const s2 = wb.addWorksheet("Notes");
  s2.getCell("A1").value = "Action items for Q3";
  s2.getCell("A2").value = "1. Finalize FY27 hiring plan by July.";
  s2.getCell("A3").value = "2. Launch the partner referral program in two pilots.";
  s2.getCell("A4").value = "3. Reduce average ticket-resolution time from 14h to under 9h.";
  s2.getCell("A5").value = "Approved by Jane Doe, CFO";

  const out = path.join(__dirname, "sample-import.xlsx");
  await wb.xlsx.writeFile(out);
  const size = fs.statSync(out).size;
  console.log(`Wrote ${out} (${size} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
