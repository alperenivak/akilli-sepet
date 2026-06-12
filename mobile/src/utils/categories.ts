// =====================================================
// Kategori agaci yardimcilari (mobil)
// =====================================================
import { Category } from '../types/api';

export function getCategoryProductCount(cat: Category): number {
  if (cat.productCount != null) return cat.productCount;
  return cat._count?.products ?? 0;
}

/** Secili kategori ID'sinden ust kategori ve alt kategori ayirir */
export function resolveCategorySelection(
  tree: Category[],
  selectedId: string,
): { parentId: string; categoryId: string } {
  if (!selectedId) return { parentId: '', categoryId: '' };

  for (const root of tree) {
    if (root.id === selectedId) {
      return { parentId: root.id, categoryId: root.children?.length ? '' : root.id };
    }
    const child = root.children?.find((c) => c.id === selectedId);
    if (child) return { parentId: root.id, categoryId: child.id };
  }

  return { parentId: '', categoryId: selectedId };
}

/** Filtre icin API'ye gonderilecek kategori ID */
export function getFilterCategoryId(parentId: string, categoryId: string): string {
  if (categoryId) return categoryId;
  return parentId;
}

export function findCategoryById(tree: Category[], id: string): Category | undefined {
  for (const root of tree) {
    if (root.id === id) return root;
    const child = root.children?.find((c) => c.id === id);
    if (child) return child;
  }
  return undefined;
}
