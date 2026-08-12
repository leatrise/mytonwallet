import { readFile } from 'node:fs/promises';

export interface DappCatalog {
  featuredTitle?: string;
  categories: Array<{ id: number; name: string }>;
  sites: Array<{
    url: string;
    name: string;
    icon: string;
    manifestUrl?: string;
    description: string;
    canBeRestricted: boolean;
    isExternal: boolean;
    isFeatured?: boolean;
    isVerified?: boolean;
    categoryId?: number;
  }>;
}

interface DappCatalogFile extends DappCatalog {
  localizations?: Record<string, {
    featuredTitle?: string;
    categories?: Record<string, string>;
    sites?: Record<string, { name?: string; description?: string }>;
  }>;
}

export class DappCatalogService {
  #catalog: DappCatalogFile;

  constructor(catalog: DappCatalogFile) {
    this.#catalog = catalog;
  }

  static async fromFile(path: string) {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as DappCatalogFile;
    validateCatalog(parsed);
    return new DappCatalogService(parsed);
  }

  get(isLandscape: boolean, langCode: string): DappCatalog {
    void isLandscape;
    const { localizations, ...catalog } = this.#catalog;
    const localization = localizations?.[langCode];
    if (!localization) return catalog;

    return {
      ...catalog,
      featuredTitle: localization.featuredTitle ?? catalog.featuredTitle,
      categories: catalog.categories.map((category) => ({
        ...category,
        name: localization.categories?.[String(category.id)] ?? category.name,
      })),
      sites: catalog.sites.map((site) => ({
        ...site,
        ...localization.sites?.[site.url],
      })),
    };
  }
}

function validateCatalog(catalog: DappCatalogFile) {
  if (!catalog || !Array.isArray(catalog.categories) || !Array.isArray(catalog.sites)) {
    throw new Error('Invalid DApp catalog');
  }
  if (catalog.categories.some((category) => !Number.isInteger(category.id) || !category.name)) {
    throw new Error('Invalid DApp category');
  }
  if (catalog.sites.some((site) => !site.url || !site.name || !site.icon || !site.description
    || typeof site.canBeRestricted !== 'boolean' || typeof site.isExternal !== 'boolean')) {
    throw new Error('Invalid DApp site');
  }
}
