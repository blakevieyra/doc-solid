"use client";

export function SignatureFieldPickerRow({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="security-toggle signature-field-picker-row">
      <input type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} />
      <div className="signature-field-picker-body">
        <div className="signature-field-picker-icon" aria-hidden>
          ✍
        </div>
        <div className="signature-field-picker-text">
          <strong>{label}</strong>
          <span>Recipient signature field</span>
        </div>
      </div>
    </label>
  );
}
