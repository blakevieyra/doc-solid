import type { TableColumn } from "@doc-solid/documents";

export interface StructuredTableRow {
  id: string;
  [key: string]: string | number;
}

export function createStructuredRow(columns: TableColumn[]): StructuredTableRow {
  const row: StructuredTableRow = {
    id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  for (const col of columns) {
    row[col.key] = "";
  }
  return row;
}

export function parseStructuredRows(raw: string | undefined, columns: TableColumn[]): StructuredTableRow[] {
  if (!raw?.trim()) return [createStructuredRow(columns)];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [createStructuredRow(columns)];

    return parsed.map((entry, index) => {
      if (typeof entry !== "object" || entry === null) {
        return createStructuredRow(columns);
      }
      const record = entry as Record<string, unknown>;
      const row: StructuredTableRow = {
        id: typeof record.id === "string" && record.id ? record.id : `row_${index}_${Date.now()}`,
      };
      for (const col of columns) {
        const val = record[col.key];
        row[col.key] = val == null ? "" : String(val);
      }
      return row;
    });
  } catch {
    return [createStructuredRow(columns)];
  }
}

export function serializeStructuredRows(rows: StructuredTableRow[]): string {
  return JSON.stringify(rows);
}

export function updateStructuredCell(
  row: StructuredTableRow,
  key: string,
  value: string
): StructuredTableRow {
  return { ...row, [key]: value };
}

export function structuredRowHasContent(row: StructuredTableRow, columns: TableColumn[]): boolean {
  return columns.some((col) => String(row[col.key] ?? "").trim() !== "");
}
