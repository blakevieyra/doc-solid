"use client";

import {
  type LineItem,
  parseLineItems,
  serializeLineItems,
  createLineItem,
  updateLineItem,
  calcSubtotal,
  calcTax,
  calcTotal,
  formatCurrency,
} from "@/lib/documents/lineItems";

interface LineItemEditorProps {
  value: string;
  onChange: (serialized: string) => void;
  taxRate?: string;
  onTotalsChange?: (totals: { subtotal: string; taxAmount: string; total: string }) => void;
}

export function LineItemEditor({ value, onChange, taxRate = "0", onTotalsChange }: LineItemEditorProps) {
  const items = parseLineItems(value);

  function emit(nextItems: LineItem[]) {
    onChange(serializeLineItems(nextItems));
    if (onTotalsChange) {
      const subtotal = calcSubtotal(nextItems);
      const tax = calcTax(subtotal, parseFloat(taxRate) || 0);
      onTotalsChange({
        subtotal: subtotal.toFixed(2),
        taxAmount: tax.toFixed(2),
        total: calcTotal(subtotal, tax).toFixed(2),
      });
    }
  }

  function updateItem(index: number, field: keyof LineItem, val: string | number) {
    const next = items.map((item, i) =>
      i === index ? updateLineItem(item, field, val) : item
    );
    emit(next);
  }

  function addRow() {
    emit([...items, createLineItem()]);
  }

  function removeRow(index: number) {
    if (items.length <= 1) return;
    emit(items.filter((_, i) => i !== index));
  }

  const subtotal = calcSubtotal(items);

  return (
    <div className="line-item-editor">
      <div className="line-item-table-wrap">
        <table className="line-item-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Item or service description"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.qty}
                    onChange={(e) => updateItem(index, "qty", parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) => updateItem(index, "rate", parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="line-item-amount">{formatCurrency(item.amount)}</td>
                <td>
                  <button type="button" className="line-item-remove" onClick={() => removeRow(index)} title="Remove row">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="line-item-footer">
        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>+ Add Line Item</button>
        <span className="line-item-subtotal">Subtotal: {formatCurrency(subtotal)}</span>
      </div>
    </div>
  );
}

export function LineItemsTable({ value }: { value: string }) {
  const items = parseLineItems(value).filter(
    (i) => i.description?.trim() || i.amount > 0 || i.rate > 0 || (i.qty > 0 && i.qty !== 1)
  );
  if (items.length === 0) return null;

  return (
    <table className="doc-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.description || "—"}</td>
            <td>{item.qty}</td>
            <td>{formatCurrency(item.rate)}</td>
            <td>{formatCurrency(item.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
