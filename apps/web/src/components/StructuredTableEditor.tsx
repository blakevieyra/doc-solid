"use client";

import type { TableColumn } from "@doc-solid/documents";
import {
  createStructuredRow,
  parseStructuredRows,
  serializeStructuredRows,
  updateStructuredCell,
} from "@/lib/documents/structuredTable";

interface StructuredTableEditorProps {
  value: string;
  onChange: (serialized: string) => void;
  columns: TableColumn[];
  addRowLabel?: string;
}

function inputTypeForColumn(col: TableColumn): string {
  switch (col.type) {
    case "date":
      return "date";
    case "number":
    case "currency":
      return "number";
    default:
      return "text";
  }
}

export function StructuredTableEditor({
  value,
  onChange,
  columns,
  addRowLabel = "+ Add Row",
}: StructuredTableEditorProps) {
  const rows = parseStructuredRows(value, columns);

  function emit(nextRows: ReturnType<typeof parseStructuredRows>) {
    onChange(serializeStructuredRows(nextRows));
  }

  function updateCell(rowIndex: number, key: string, val: string) {
    emit(rows.map((row, i) => (i === rowIndex ? updateStructuredCell(row, key, val) : row)));
  }

  function addRow() {
    emit([...rows, createStructuredRow(columns)]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return;
    emit(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="line-item-editor structured-table-editor">
      <div className="line-item-table-wrap">
        <table className="line-item-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th aria-label="Remove row" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.type === "textarea" ? (
                      <textarea
                        value={String(row[col.key] ?? "")}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        placeholder={col.placeholder}
                        rows={2}
                      />
                    ) : (
                      <input
                        type={inputTypeForColumn(col)}
                        value={String(row[col.key] ?? "")}
                        onChange={(e) => updateCell(rowIndex, col.key, e.target.value)}
                        placeholder={col.placeholder}
                        step={col.type === "currency" ? "0.01" : undefined}
                      />
                    )}
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="line-item-remove"
                    onClick={() => removeRow(rowIndex)}
                    title="Remove row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="line-item-footer">
        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
          {addRowLabel}
        </button>
      </div>
    </div>
  );
}
