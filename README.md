# Smart Expense Categorizer using ocr

A modern, production-style fintech web app that turns paper receipts into a clean spending dashboard — entirely on-device.

## What it does
 
1. **Drag & drop a receipt** (JPG / JPEG / PNG)
2. **OCR on-device** with Tesseract.js extracts the raw text + confidence score
3. **Smart parser** auto-detects merchant, amount and date         
4. **Categorization engine** (`lib/utils/categorize.js`) tags it as Food / Travel / Shopping / Entertainment / Health / Utilities / Other
5. **Local-first storage** — every expense is persisted to `localStorage`
6. **Analytics dashboard** with KPIs, pie / bar / line charts and auto-generated insights
7. **Bonus**: filter by category, by date range, search merchant, edit, delete, CSV export, seed sample data

No login. No API key. No backend. 100% browser-side.

## Tech

- Next.js 14 (App Router) + JavaScript
- Tailwind CSS + shadcn/ui
- Tesseract.js (OCR)
- Recharts (charts)
- sonner (toasts)
- localStorage (persistence)

## Run

```bash
yarn install
yarn dev
```

Open http://localhost:3000

## Folder structure

```
app/
  layout.js          # dark fintech shell
  page.js            # the full app (upload, OCR, dashboard, filters, table)
  globals.css        # theme tokens (vibrant violet primary in dark mode)
lib/
  utils/
    categorize.js    # category rules, parser, insight generator
components/ui/       # shadcn/ui
```
.
## Categorization rules

Defined in `lib/utils/categorize.js` — extend the `CATEGORIES` map with more keywords as needed. Priority: merchant-name match → keyword match → `Other`.
