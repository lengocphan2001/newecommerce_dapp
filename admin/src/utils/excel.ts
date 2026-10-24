export type ExcelCellValue = string | number | boolean | Date | null | undefined;

export interface ExcelColumn<T> {
  header: string;
  width?: number;
  /** Excel number format, e.g. MONEY_FORMAT. */
  numFmt?: string;
  value: (row: T, index: number) => ExcelCellValue;
  /** Turns the cell into a clickable link, e.g. an image URL. */
  link?: (row: T, index: number) => string | undefined | null;
}

export interface ExcelExportOptions<T> {
  fileName: string;
  sheetName: string;
  /** Lines written above the table, e.g. the report title and filters. */
  titleLines?: string[];
  columns: ExcelColumn<T>[];
  rows: T[];
  /** Optional totals row, one value per column (undefined leaves a cell empty). */
  totals?: ExcelCellValue[];
}

export const MONEY_FORMAT = '#,##0.00';
export const PERCENT_FORMAT = '0.0%';

/**
 * Build an .xlsx file in the browser and download it.
 *
 * exceljs is loaded on demand so it does not weigh on the initial admin bundle.
 */
export async function downloadExcel<T>({
  fileName,
  sheetName,
  titleLines = [],
  columns,
  rows,
  totals,
}: ExcelExportOptions<T>): Promise<void> {
  const ExcelJS = await import('exceljs');
  const Workbook = ((ExcelJS as any).Workbook ??
    (ExcelJS as any).default.Workbook) as typeof ExcelJS.Workbook;

  const workbook = new Workbook();
  workbook.created = new Date();
  // Excel limits sheet names to 31 characters and forbids some symbols.
  const sheet = workbook.addWorksheet(
    sheetName.replace(/[\\/?*[\]:]/g, '-').slice(0, 31),
  );

  titleLines.forEach((line, i) => {
    const row = sheet.addRow([line]);
    row.font = i === 0 ? { bold: true, size: 14 } : { italic: true };
  });
  if (titleLines.length > 0) sheet.addRow([]);

  const headerRow = sheet.addRow(columns.map((c) => c.header));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  });
  const headerRowNumber = headerRow.number;

  rows.forEach((r, i) => {
    const row = sheet.addRow(columns.map((c) => normalize(c.value(r, i))));
    columns.forEach((c, colIndex) => {
      if (!c.link) return;
      const hyperlink = c.link(r, i);
      if (!hyperlink) return;
      const cell = row.getCell(colIndex + 1);
      cell.value = { text: String(cell.value ?? hyperlink), hyperlink };
      cell.font = { color: { argb: 'FF1D4ED8' }, underline: true };
    });
  });

  if (totals) {
    const totalRow = sheet.addRow(totals.map(normalize));
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      cell.border = { top: { style: 'thin' } };
    });
  }

  columns.forEach((c, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = c.width ?? Math.max(12, c.header.length + 2);
    if (c.numFmt) column.numFmt = c.numFmt;
  });

  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber + rows.length, column: columns.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const url = window.URL.createObjectURL(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function normalize(value: ExcelCellValue): string | number | boolean | Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}
