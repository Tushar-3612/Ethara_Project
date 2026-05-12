const ExcelJS = require("exceljs");

const styleHeaderRow = (row) => {
  row.font = { bold: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E7FF" },
  };
};

/**
 * @param {Array<Record<string, unknown>>} rows
 */
async function attendanceToWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Attendance");
  ws.columns = [
    { header: "Student Name", key: "studentName", width: 28 },
    { header: "Batch", key: "batch", width: 14 },
    { header: "Total Days", key: "totalDays", width: 12 },
    { header: "Present", key: "present", width: 10 },
    { header: "Absent", key: "absent", width: 10 },
    { header: "Late", key: "late", width: 10 },
    { header: "Percentage", key: "percentage", width: 12 },
  ];
  rows.forEach((r) => ws.addRow(r));
  styleHeaderRow(ws.getRow(1));
  return wb;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 */
async function projectsToWorkbook(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Projects");
  ws.columns = [
    { header: "Student Name", key: "studentName", width: 28 },
    { header: "Total Projects", key: "totalProjects", width: 14 },
    { header: "Completed", key: "completed", width: 12 },
    { header: "In Progress", key: "inProgress", width: 12 },
    { header: "Completion Rate %", key: "completionRate", width: 16 },
  ];
  rows.forEach((r) => ws.addRow(r));
  styleHeaderRow(ws.getRow(1));
  return wb;
}

/**
 * @param {{ attendanceRows: Array<Record<string, unknown>>; projectRows: Array<Record<string, unknown>>; studentName: string }} payload
 */
async function individualStudentWorkbook(payload) {
  const wb = new ExcelJS.Workbook();
  const { attendanceRows, projectRows, studentName } = payload;

  const ws1 = wb.addWorksheet("Attendance");
  ws1.columns = [
    { header: "Date", key: "dateKey", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Punch Time", key: "punchTime", width: 14 },
    { header: "Late (min)", key: "lateMinutes", width: 12 },
    { header: "Notes", key: "reason", width: 28 },
  ];
  attendanceRows.forEach((r) => ws1.addRow(r));
  styleHeaderRow(ws1.getRow(1));

  const ws2 = wb.addWorksheet("Projects");
  ws2.columns = [
    { header: "Project", key: "title", width: 32 },
    { header: "Status", key: "status", width: 14 },
    { header: "Deadline", key: "deadline", width: 18 },
    { header: "Started At", key: "startedAt", width: 20 },
    { header: "Completed At", key: "completedAt", width: 20 },
  ];
  projectRows.forEach((r) => ws2.addRow(r));
  styleHeaderRow(ws2.getRow(1));

  wb.creator = "Ethara Reports";
  wb.title = studentName;
  return wb;
}

function rowsToCsv(columns, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => esc(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => esc(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}

async function workbookToBuffer(wb) {
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

module.exports = {
  attendanceToWorkbook,
  projectsToWorkbook,
  individualStudentWorkbook,
  rowsToCsv,
  workbookToBuffer,
};
