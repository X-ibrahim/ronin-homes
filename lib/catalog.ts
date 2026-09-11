export type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
};

export type CatalogAttribute = { key: string; value: string };

export type CatalogProduct = {
  id: string;
  slug: string;
  categoryId?: string;
  title: string;
  price: number;
  images: string[];
  attributes: CatalogAttribute[];
};

function adminApiUrl(path: string) {
  const base = process.env.ADMIN_API_URL ?? 'http://localhost:3001';
  return `${base}${path}`;
}

// Both hit ronin-admin's public catalog API (storefront: "homes") — call from
// a Server Component and pass the result down, since these hit the network.
export async function getCategories(): Promise<CatalogCategory[]> {
  try {
    const res = await fetch(adminApiUrl('/api/public/catalog/homes/categories'), { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getProducts(): Promise<CatalogProduct[]> {
  try {
    const res = await fetch(adminApiUrl('/api/public/catalog/homes/products'), { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function tagOf(product: CatalogProduct): string {
  return product.attributes.find(a => a.key === 'tag')?.value ?? '';
}
