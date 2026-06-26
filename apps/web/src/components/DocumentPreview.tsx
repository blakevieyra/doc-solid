"use client";



import type { DocumentTypeDefinition, TemplateField } from "@doc-solid/documents";
import { extractDocumentNumberFromValues } from "@doc-solid/documents";

import type { UserProfile } from "@/lib/profile/types";

import { isFinancialTotalField } from "@/lib/documents/tableDisplay";

import { TableFieldPreview } from "@/components/TableFieldPreview";

import {

  parseSignatureValue,

  isCounterpartySignatureField,

} from "@/lib/profile/signature";

import { resolveDocumentLetterhead } from "@/lib/profile/document-branding";
import { RedactedValue, isRedactedValue } from "@/components/RedactedValue";
import { FREE_PLAN_WATERMARK_TEXT } from "@/lib/pdf/exportDocument";



interface DocumentPreviewProps {

  meta: DocumentTypeDefinition;

  values: Record<string, string>;

  profile: UserProfile;

  /** When true, letterhead uses saved field values only (shared / sent documents) */
  lockBranding?: boolean;

  /** Override default id="document-preview" for multi-doc pages like packets */
  previewId?: string;
  /** Show diagonal watermark when printing (Free plan) */
  watermark?: boolean;
}



export function DocumentPreview({ meta, values, profile, lockBranding, previewId, watermark }: DocumentPreviewProps) {

  const letterhead = resolveDocumentLetterhead(profile, values, { valuesOnly: lockBranding });
  const displayNumber = extractDocumentNumberFromValues(values);

  const hasPoc =
    letterhead.pocName ||
    letterhead.pocTitle ||
    letterhead.pocPhone ||
    letterhead.pocEmail;

  const contactParts = [
    letterhead.phone && `Tel: ${letterhead.phone}`,
    letterhead.email,
  ].filter(Boolean);

  const pocContactParts = [
    letterhead.pocPhone && `Tel: ${letterhead.pocPhone}`,
    letterhead.pocEmail,
  ].filter(Boolean);

  function renderLetterheadText(value: string) {
    if (isRedactedValue(value)) return <RedactedValue />;
    return value;
  }



  return (

    <>

    <article className="doc-preview" id={previewId ?? "document-preview"}>

      <header className="doc-preview-header">

        <div className="doc-preview-brand">

          {letterhead.logo && (

            <div className="doc-preview-logo-wrap">

              <img src={letterhead.logo} alt="" className="doc-preview-logo" />

            </div>

          )}

          <div className="doc-preview-brand-text">

            <h1 className="doc-preview-company">{renderLetterheadText(letterhead.companyName)}</h1>

            {letterhead.tagline && (

              <p className="doc-preview-tagline">{renderLetterheadText(letterhead.tagline)}</p>

            )}

            {letterhead.address && (

              <p className="doc-preview-letterhead-line doc-preview-letterhead-address">{renderLetterheadText(letterhead.address)}</p>

            )}

            {contactParts.length > 0 && (

              <p className="doc-preview-letterhead-line">{contactParts.map((part, index) => (
                <span key={`${part}-${index}`}>
                  {index > 0 && " · "}
                  {part.startsWith("Tel: ")
                    ? <>Tel: {renderLetterheadText(part.slice(5))}</>
                    : renderLetterheadText(part)}
                </span>
              ))}</p>

            )}

            {letterhead.website && (

              <p className="doc-preview-letterhead-line doc-preview-letterhead-website">{renderLetterheadText(letterhead.website)}</p>

            )}

            {hasPoc && (

              <div className="doc-preview-letterhead-poc">

                <p className="doc-preview-letterhead-poc-label">Point of Contact</p>

                {letterhead.pocName && (

                  <p className="doc-preview-letterhead-line doc-preview-letterhead-poc-name">

                    {renderLetterheadText(letterhead.pocName)}

                    {letterhead.pocTitle && (

                      <span className="doc-preview-letterhead-poc-title">, {renderLetterheadText(letterhead.pocTitle)}</span>

                    )}

                  </p>

                )}

                {pocContactParts.length > 0 && (

                  <p className="doc-preview-letterhead-line">{pocContactParts.map((part, index) => (
                    <span key={`${part}-${index}`}>
                      {index > 0 && " · "}
                      {part.startsWith("Tel: ")
                        ? <>Tel: {renderLetterheadText(part.slice(5))}</>
                        : renderLetterheadText(part)}
                    </span>
                  ))}</p>

                )}

              </div>

            )}

          </div>

        </div>

        <div className="doc-preview-meta">

          <h2 className="doc-preview-title">{meta.name.toUpperCase()}</h2>

          {displayNumber && (
            <p><span className="doc-label">No.</span> {displayNumber}</p>
          )}

          {(values.documentDate || values.invoiceDate) && (

            <p><span className="doc-label">Date</span> {formatDate(values.documentDate || values.invoiceDate)}</p>

          )}

          {values.dueDate && (

            <p><span className="doc-label">Due</span> {formatDate(values.dueDate)}</p>

          )}

        </div>

      </header>



      <div className="doc-preview-divider" />



      {meta.sections.map((section) => (

        <SectionPreview

          key={section.id}

          section={section}

          values={values}

          docCategory={meta.category}

        />

      ))}



      <footer className="doc-preview-footer">

        <p className="doc-preview-generated">

          Generated by DocSolid · {new Date().toLocaleDateString()}

        </p>

      </footer>

    </article>

    {watermark && (
      <div className="doc-preview-print-watermark" aria-hidden="true">
        {FREE_PLAN_WATERMARK_TEXT}
      </div>
    )}

    </>

  );

}



function SectionPreview({

  section,

  values,

  docCategory,

}: {

  section: DocumentTypeDefinition["sections"][number];

  values: Record<string, string>;

  docCategory: string;

}) {

  const hasLineItems = section.fields.some((f) => f.id === "lineItems" && values[f.id]);

  const totalFields = hasLineItems

    ? section.fields.filter((f) => isFinancialTotalField(f.id) && values[f.id])

    : [];



  const signatureFields = section.fields.filter((f) => f.type === "signature");

  const orderedFields = section.fields.filter((f) => {

    if (f.type === "signature") return false;

    if (!values[f.id] || f.type === "image") return false;

    if (hasLineItems && isFinancialTotalField(f.id)) return false;

    return true;

  });



  const hasSignatureSlots = signatureFields.some(

    (f) => values[f.id] || f.required || isCounterpartySignatureField(f, docCategory)

  );



  if (orderedFields.length === 0 && totalFields.length === 0 && !hasSignatureSlots) return null;



  return (

    <section className="doc-preview-section">

      <h3 className="doc-preview-section-title">{section.title}</h3>



      {orderedFields.map((field) => {

        if (field.type === "table") {

          return (

            <div key={field.id} className="doc-preview-table-wrap">

              <h4 className="doc-preview-table-label">{field.label}</h4>

              <TableFieldPreview fieldId={field.id} label={field.label} value={values[field.id]} />

            </div>

          );

        }



        return (

          <dl key={field.id} className="doc-preview-fields doc-preview-fields-single">

            <div className={`doc-field doc-field-${field.type}`}>

              <dt>{field.label}</dt>

              <dd>

                {isRedactedValue(values[field.id]) ? (
                  <RedactedValue />
                ) : field.type === "textarea" ? (

                  values[field.id].split("\n").map((line, i, arr) => (

                    <span key={i}>

                      {line}

                      {i < arr.length - 1 && <br />}

                    </span>

                  ))

                ) : (

                  formatValue(values[field.id], field)

                )}

              </dd>

            </div>

          </dl>

        );

      })}



      {totalFields.length > 0 && (

        <div className="doc-totals">

          {totalFields.map((field) => (

            <div

              key={field.id}

              className={`doc-total-row${field.id === "total" ? " doc-total-final" : ""}`}

            >

              <span>{field.label}</span>

              <span>{isRedactedValue(values[field.id]) ? <RedactedValue /> : formatValue(values[field.id], field)}</span>

            </div>

          ))}

        </div>

      )}



      {signatureFields.length > 0 && (

        <div className="doc-preview-signatures doc-preview-signatures-inline">

          {signatureFields.map((field) => {

            const value = values[field.id] ?? "";

            const showEmpty =

              !value &&

              (field.required || isCounterpartySignatureField(field, docCategory));

            if (!value && !showEmpty) return null;



            return (

              <DocumentSignatureBlock

                key={field.id}

                label={field.label}

                value={value}

                pending={showEmpty}

                date={

                  values.signatureDate && field.id !== "signatureDate"

                    ? formatDate(values.signatureDate)

                    : undefined

                }

              />

            );

          })}

        </div>

      )}

    </section>

  );

}



function DocumentSignatureBlock({

  label,

  value,

  date,

  pending,

}: {

  label: string;

  value: string;

  date?: string;

  pending?: boolean;

}) {

  const payload = parseSignatureValue(value);



  if (pending && !value.trim()) {

    return (

      <div className="doc-signature-block doc-signature-block-pending">

        <div className="doc-signature-line-wrap">

          <div className="doc-signature-line" aria-hidden="true" />

        </div>

        <span className="doc-signature-label">{label}</span>

        <span className="doc-signature-pending">Awaiting signature</span>

      </div>

    );

  }



  return (

    <div className="doc-signature-block">

      <div className="doc-signature-line-wrap">

        <div className="doc-signature-on-line" aria-hidden={!payload && !value}>

          {payload?.image && payload.mode === "drawn" ? (

            <img

              src={payload.image}

              alt={label}

              className="doc-signature-on-line-image"

            />

          ) : payload ? (

            <span className="doc-signature-on-line-cursive">{payload.name}</span>

          ) : value ? (

            <span className="doc-signature-on-line-cursive">{value}</span>

          ) : null}

        </div>

        <div className="doc-signature-line" aria-hidden="true" />

      </div>

      <span className="doc-signature-label">{label}</span>

      {payload ? (

        <>

          <span className="doc-signature-name">{payload.name}</span>

          {payload.title && <span className="doc-signature-title">{payload.title}</span>}

          {payload.entity && <span className="doc-signature-entity">{payload.entity}</span>}

        </>

      ) : value ? (

        <span className="doc-signature-name">{value}</span>

      ) : null}

      {date && <span className="doc-signature-date">{date}</span>}

    </div>

  );

}



function formatDate(val: string): string {

  if (!val) return "";

  try {

    return new Date(val + "T00:00:00").toLocaleDateString("en-US", {

      year: "numeric",

      month: "long",

      day: "numeric",

    });

  } catch {

    return val;

  }

}



function formatValue(val: string, field: TemplateField): string {

  if (!val) return "—";

  if (field.type === "currency") {

    const num = parseFloat(val);

    return isNaN(num) ? val : num.toLocaleString("en-US", { style: "currency", currency: "USD" });

  }

  if (field.type === "number" && field.id === "taxRate") {

    return `${val}%`;

  }

  return val;

}


