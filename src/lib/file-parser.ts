import * as XLSX from "xlsx";
import Papa from "papaparse";

export type ParsedFile = {
  data: Record<string, unknown>[];
  headers: string[];
  isCSV: boolean;
  csvDelimiter?: string;
  sheetName?: string;
  sheetNames?: string[];          // hojas disponibles en el archivo Excel
  rawRows?: unknown[][];
  headerRowIndex?: number;
};

// ── Lógica compartida para parsear una worksheet ────────────────────────────
function parseWorksheet(
  ws: XLSX.WorkSheet
): Pick<ParsedFile, "data" | "headers" | "rawRows" | "headerRowIndex"> {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  let headerRowIndex = 0;

  if (rawRows.length >= 2) {
    const firstRowNonEmpty  = (rawRows[0] as unknown[]).filter((c) => String(c ?? "").trim() !== "").length;
    const secondRowNonEmpty = (rawRows[1] as unknown[]).filter((c) => String(c ?? "").trim() !== "").length;

    if (firstRowNonEmpty <= 2 && secondRowNonEmpty > firstRowNonEmpty * 2) {
      headerRowIndex = 1;
    }
  }

  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    range: headerRowIndex,
  });
  const headers = data.length ? Object.keys(data[0]) : [];

  return { data, headers, rawRows, headerRowIndex };
}

export function parseExcel(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames;           // ← NUEVO
  const sheetName  = sheetNames[0];
  const ws = wb.Sheets[sheetName];

  const { data, headers, rawRows, headerRowIndex } = parseWorksheet(ws);

  return {
    data,
    headers,
    isCSV: false,
    sheetName,
    sheetNames,                               // ← NUEVO
    rawRows,
    headerRowIndex,
  };
}

// ── NUEVA FUNCIÓN: parsear una hoja específica por nombre ───────────────────
export function parseExcelSheet(buffer: ArrayBuffer, sheetName: string): ParsedFile {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });

  if (!wb.SheetNames.includes(sheetName)) {
    throw new Error(`La hoja "${sheetName}" no existe en el archivo.`);
  }

  const ws = wb.Sheets[sheetName];
  const { data, headers, rawRows, headerRowIndex } = parseWorksheet(ws);

  return {
    data,
    headers,
    isCSV: false,
    sheetName,
    sheetNames: wb.SheetNames,
    rawRows,
    headerRowIndex,
  };
}

export function parseCSV(text: string): ParsedFile {
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });
  const headers = (result.meta.fields ?? []) as string[];
  return {
    data: result.data,
    headers,
    isCSV: true,
    csvDelimiter: result.meta.delimiter ?? ",",
  };
}

export function exportFile(
  rows: Record<string, unknown>[],
  cols: string[],
  format: string,
  reportName: string
): void {
  const ordered = rows.map((r) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c) => { o[c] = r[c] !== undefined ? r[c] : ""; });
    return o;
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const fname = `ETL_${reportName.toUpperCase()}_${ts}.${format}`;

  if (format === "csv") {
    const csv = Papa.unparse(ordered, { columns: cols });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
  } else {
    const ws = XLSX.utils.json_to_sheet(ordered, { header: cols });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DMO_WORKSHEET");
    const bookType = format === "xls" ? "biff8" : (format as XLSX.BookType);
    XLSX.writeFile(wb, fname, { bookType });
  }
}