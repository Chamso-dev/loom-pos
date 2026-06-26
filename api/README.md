# Product identification backend (`api/identify`)

Identifies a product from its barcode using **Google's official Custom Search
JSON API** (plus OpenFoodFacts for clean structured data) and returns normalized
fields to the POS. The Google API key lives **only** in this backend's
environment — it is never shipped to the app or shown to users.

## Deploy (Vercel example)

1. Create a Google Cloud API key and enable **Custom Search API**.
2. Create a **Programmable Search Engine** (https://programmablesearchengine.google.com),
   set it to **search the entire web**, and copy its **Search engine ID** (`cx`).
3. Deploy this repo (or just the `api/` folder) to Vercel. `api/identify.js` is
   auto-served at `/api/identify`.
4. Set environment variables in the deployment:
   - `GOOGLE_API_KEY` — the API key from step 1
   - `GOOGLE_CX` — the search engine ID from step 2
5. Point the app at it: set the GitHub repo **variable** `IDENTIFY_ENDPOINT` to
   `https://<your-deployment>/api/identify`, then re-run the APK build. (Locally:
   `VITE_IDENTIFY_ENDPOINT=… npm run build`.)

## Behaviour

- `GET /api/identify?barcode=<ean/upc>` →
  `{ found, name, brand, category, size, image, description, confidence, source }`
- If `GOOGLE_API_KEY`/`GOOGLE_CX` are unset, it still answers from
  OpenFoodFacts. If nothing is found it returns `{ found: false }`.
- When `IDENTIFY_ENDPOINT` is not configured, the app skips the backend and uses
  the key-less public databases directly — so product lookup keeps working with
  no backend at all, just with less coverage.
