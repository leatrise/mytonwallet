# Explore catalog

The Explore page normally loads its catalog from:

```text
GET {BRILLIANT_API_BASE_URL}/v2/dapp/catalog?isLandscape=false&langCode=en
```

If that request fails, the client uses
`src/api/data/exploreCatalog.ts`. This fallback is deliberately bundled with
the application so that Explore does not become empty during a backend outage.

## Updating the emergency catalog

1. Edit `src/api/data/exploreCatalog.ts`.
2. Use a unique numeric category ID and reference it from each site's
   `categoryId`.
3. Only set `isVerified` after the site and its ownership have been reviewed.
4. Only set `isFeatured` for applications that should appear in the top
   carousel.
5. Set `canBeRestricted` for applications that may require regional filtering.
6. Run `npm run check` before publishing.

The backend catalog remains the source of truth. Updating this file is only
needed when the approved emergency list changes, not for every routine catalog
update.

## Recommended backend workflow

Store catalog entries with `pending`, `approved`, `rejected`, and `disabled`
states. A scheduled importer may create or refresh pending entries from an
external directory or submission form, but only approved entries should be
returned by `/v2/dapp/catalog`. Keep verification, featuring, category, region
restriction, and ordering as explicit reviewer-controlled fields.
