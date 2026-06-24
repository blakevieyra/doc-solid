export type DocumentDomain = "business" | "individual" | "organization";

export type DocumentCategory =
  | "financial"
  | "legal"
  | "hr"
  | "sales"
  | "operations"
  | "marketing"
  | "compliance"
  | "personal"
  | "real-estate"
  | "health"
  | "education"
  | "nonprofit"
  | "governance"
  | "project"
  | "communication";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "email"
  | "phone"
  | "address"
  | "select"
  | "checkbox"
  | "signature"
  | "table"
  | "image";

export type TableColumnType = "text" | "textarea" | "number" | "currency" | "date";

export interface TableColumn {
  key: string;
  label: string;
  type?: TableColumnType;
  placeholder?: string;
}

export interface TemplateField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  defaultFromProfile?: string;
  /** When true, auto-fills from the account owner's saved signature */
  ownerSignature?: boolean;
  helpText?: string;
  /** Column schema for structured table fields (non–line-item tables) */
  tableColumns?: TableColumn[];
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  fields: TemplateField[];
}

export interface DocumentTypeDefinition {
  id: string;
  name: string;
  description: string;
  domain: DocumentDomain;
  category: DocumentCategory;
  priority: "essential" | "common" | "specialized";
  tags: string[];
  /** Primary industry/legal standards this template draws from */
  primaryResources: string[];
  sections: TemplateSection[];
}

export interface DocumentCatalogEntry
  extends Omit<DocumentTypeDefinition, "sections"> {
  sectionCount: number;
  fieldCount: number;
  hasFullTemplate: boolean;
}
