# UF Public Trial Gardens Website (prototype)

A static-rendered Next.js site modeled on the layout at `glenbradford.com/gaby`, rebuilt against the
mock data provided, styled to the UF/IFAS web standard so it
matches [trec.ifas.ufl.edu](https://trec.ifas.ufl.edu), and configured to deploy on Azure Static Web
Apps under UF's existing Microsoft infra.

Current demo (GitHub Pages): https://dannyofmiami.github.io/uf-trial-gardens/

## Stack

- Framework: Next.js 15 (App Router) and React 19, exported as static files so there is no server to run
- Language: TypeScript
- Styling: Tailwind CSS v4 (the UF/IFAS colors are all in one `@theme` block)
- Fonts: Anybody, IBM Plex Sans, Source Serif 4, IBM Plex Mono (open source and in UF use)
- Data: JSON built from the spreadsheet, no database needed yet
- Hosting: GitHub Pages for now, Azure Static Web Apps for implementation later
- CI/CD: GitHub Actions, workflow in `.github/workflows/`

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

## Refresh the trial data

(Current process but can be implemented differently later)
Drop a new spreadsheet in the project root and re-run the importer:

```bash
npm run import -- "./DATA Trial Garden Website V.2.xlsx"
npm run build
```

The importer (`scripts/import-xlsx.mjs`) expects one worksheet per evaluation date, named
`MMDDYYYY`, with these columns:

`YEAR · Plant Name · GENUS · SUPPLIER · Uniformity · Flower Power · Foliage · Heat Resistance · Overall Rating · FLOWER COLOR · PLANT IMAGE 1`

It writes `data/trials.json`

## Trial photos


```bash
# In Dropbox: open the shared folder → select all → Download → unzip
npm install
node scripts/import-photos.mjs ~/Downloads/TrialPhotos    # or: npm run photos -- <folder>
npm run build
```

Matching is by original filename, which every URL preserves
(`…/scl/fi/<key>/BAL_0001.JPG`); all 86 are unique. The script searches
subfolders, ignores case, and reports mismatches in both directions.

It resizes too, `--dry-run` previews; `--keep-original` skips resizing.

<!-- `npm run mirror` is a different script for a different situation - it downloads *publicly*
shared links. It will fail on these, because Node's fetch has no Dropbox session. Kept in
case the folder is ever re-shared as "anyone with the link". -->

## Data quality in v1

- 96.3% of all scores are 5.0, and the most recent evaluation (2026-03-10) rates every entry 5.0
  in all four categories.
- FLOWER COLOR is empty for all 89 cultivars, so the color filter is omitted rather than shipped broken.
- 3 of 89 rows have no photo
- No observation notes or weather readings exist in the source, though the reference layout shows both.

<!-- ## Deploy to Azure Static Web Apps

1. Create the resource:
   ```bash
   az staticwebapp create \
     --name uf-trial-gardens \
     --resource-group rg-trial-gardens \
     --location eastus2 \
     --sku Free
   ```
2. Copy the deployment token into the GitHub repo as the secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
3. Push to `main`. Every PR gets its own preview URL automatically.

`staticwebapp.config.json` sets the security headers (CSP, HSTS, nosniff) and the SPA fallback. -->

## Project layout

```
app/                    routes (App Router)
  page.tsx              home
  about/                program, methodology, rating scale
  trial-gardens/        searchable database
  trial-gardens/[id]/   one static page per cultivar (89 generated)
  partners/             suppliers derived from the data
  visit/                visit info + contact form (inert)
components/             shared UI + the client-side filter
lib/data.ts             typed accessors over data/trials.json
scripts/import-xlsx.mjs  spreadsheet -> JSON
scripts/import-photos.mjs Dropbox download -> public/plants/ (resized WebP)
scripts/mirror-images.mjs public Dropbox links -> public/plants/ (rarely applicable)
data/trials.json        generated; committed so builds are reproducible
```

## Future Work

Client portal (auth, photo galleries, downloads, comments), contact form submission, image hosting,
observation notes and weather.

### Contact form

The form on the Visit page (`app/visit/page.tsx`) doesn't send anywhere right now. It has no `action`
or submit handler, so clicking "Send message" just reloads the page and the message is lost.
