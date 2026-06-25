"use client";

import { LineItemsTable } from "@/components/LineItemEditor";
import {
  formatJsonAsList,
  formatTableCell,
  humanizeColumnKey,
  isLineItemsField,
  lineItemsHasVisibleRows,
  tryParseJsonRecords,
  tableColumnsFromRows,
} from "@/lib/documents/tableDisplay";
import { RedactedValue, isRedactedValue } from "@/components/RedactedValue";

export function TableFieldPreview({
  fieldId,
  label,
  value,
}: {
  fieldId: string;
  label: string;
  value: string;
}) {
  if (isRedactedValue(value)) {
    return (
      <div className="doc-table-block">
        <RedactedValue />
      </div>
    );
  }

  if (isLineItemsField(fieldId)) {
    if (lineItemsHasVisibleRows(value)) {
      return (
        <div className="doc-table-block">
          <div className="doc-table-scroll">
            <LineItemsTable value={value} />
          </div>
        </div>
      );
    }
    const fallbackRows = tryParseJsonRecords(value);
    if (fallbackRows && fallbackRows.length > 0) {
      const columns = tableColumnsFromRows(fallbackRows);
      return (
        <div className="doc-table-block">
          <div className="doc-table-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{humanizeColumnKey(col)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fallbackRows.map((row, rowIndex) => (
                  <tr key={String(row.id ?? rowIndex)}>
                    {columns.map((col) => (
                      <td key={col}>{formatTableCell(col, row[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return null;
  }

  const stringList = formatJsonAsList(value);
  if (stringList) {
    return (
      <div className="doc-table-block">
        <ul className="doc-preview-list">
          {stringList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  const rows = tryParseJsonRecords(value);
  if (!rows || rows.length === 0) {
    return (
      <div className="doc-table-block">
        <p className="doc-table-empty-inline">{label}: —</p>
      </div>
    );
  }

  const columns = tableColumnsFromRows(rows);

  return (
    <div className="doc-table-block">
      <div className="doc-table-scroll">
        <table className="doc-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col}>{humanizeColumnKey(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={String(row.id ?? rowIndex)}>
                {columns.map((col) => (
                  <td key={col}>{formatTableCell(col, row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
