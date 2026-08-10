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

export class DappCatalogService {
  #catalog: DappCatalog;

  constructor(catalog: DappCatalog) {
    this.#catalog = catalog;
  }

  static async fromFile(path: string) {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as DappCatalog;
    validateCatalog(parsed);
    return new DappCatalogService(parsed);
  }

  get(isLandscape: boolean, langCode: string): DappCatalog {
    // Keep the query parameters part of the contract. The static catalog is
    // currently language-neutral; future localized snapshots can branch here.
    void isLandscape;
    void langCode;
    return this.#catalog;
  }
}

function validateCatalog(catalog: DappCatalog) {
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
