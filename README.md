# Doc Solid

Professional document and form builder for **local businesses**, **individuals**, and **organizations**.

Build reports and forms, auto-fill from your profile, then **print**, **email**, **share**, and **save** to your file portal — on web and mobile, with cloud sync and offline support.

## What's included

| Package | Purpose |
|---------|---------|
| `apps/web` | Next.js web app (PWA-ready for mobile browsers) |
| `apps/mobile` | Expo React Native app (iOS & Android) |
| `packages/documents` | 120 document types + template generator |
| `packages/database` | PostgreSQL schema (Prisma) for cloud storage |
| `packages/storage` | Local IndexedDB adapter + sync queue |

## Document library (120 types)

| Domain | Count | Examples |
|--------|-------|---------|
| **Business** | 60 | Invoice, NDA, Service Agreement, Work Order, Proposal |
| **Individual** | 35 | Resume, Lease, Personal Budget, Freelance Invoice |
| **Organization** | 25 | Donation Receipt, Grant Application, Volunteer Agreement |

**50 essential** documents are flagged as highest priority. **25** have fully hand-crafted templates; the rest are auto-generated from domain field blueprints based on primary legal/industry resources (GAAP, IRS, UCC, HIPAA, PMI, etc.).

## Quick start

```bash
# Install dependencies
npm install

# Run web app
npm run dev

# Run mobile app
npm run dev:mobile
```

### Database (cloud)

```bash
cp packages/database/.env.example packages/database/.env
# Set DATABASE_URL to your PostgreSQL connection string
npm run db:push
```

## Architecture

```
Profile (auto-fill) → Pick template → Fill form → Preview
                                              ↓
                          Print / PDF / Email / Share
                                              ↓
                          Save → Local (IndexedDB/SQLite)
                                              ↓
                          Sync → Cloud (PostgreSQL + S3)
```

### Multi-user

Organizations support roles: Owner, Admin, Editor, Viewer. Team members share folders and documents through the cloud database.

### Storage strategy

- **Local first**: Documents save immediately to device storage
- **Sync queue**: Changes queue when offline, push when online
- **Cloud**: PostgreSQL for metadata, object storage for PDFs

## Key pages (web)

- `/` — Landing page with stats
- `/documents` — Browse and search 120+ document types
- `/documents/[id]` — Fill, preview, print, save
- `/portal` — File management portal
- `/profile` — Business & personal auto-fill profiles

## Next steps

- [ ] User authentication (NextAuth or Clerk)
- [ ] PDF generation engine
- [ ] Email and share link API
- [ ] Custom drag-and-drop form builder
- [ ] Mobile SQLite storage + sync
- [ ] E-signatures

## Disclaimer

Templates are starting points based on common industry standards. They are not legal advice. Consult a qualified professional for binding legal documents.
