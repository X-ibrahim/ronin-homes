import { HomePage } from '@/components/home-page';
import { getCategories, getProducts } from '@/lib/catalog';

export default async function Page() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return <HomePage categories={categories} products={products} />;
}
