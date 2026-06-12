// =====================================================
// Kategori agaci yardimcilari
// =====================================================

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  parentId?: string | null;
  sortOrder: number;
  _count?: { products: number };
};

export type CategoryTreeNode = CategoryRow & {
  children: CategoryTreeNode[];
  productCount: number;
};

/** Duz listeyi kok + children agacina donusturur */
export function buildCategoryTree(categories: CategoryRow[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [], productCount: cat._count?.products ?? 0 });
  }

  const roots: CategoryTreeNode[] = [];

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else if (!node.parentId) {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));
    nodes.forEach((n) => {
      sortNodes(n.children);
      if (n.children.length > 0) {
        n.productCount = n.children.reduce((sum, c) => sum + c.productCount, 0);
      }
    });
  };

  sortNodes(roots);
  return roots;
}

/** Agactaki tum yaprak (alt kategori) ID'lerini toplar */
export function collectLeafCategoryIds(node: CategoryTreeNode): string[] {
  if (node.children.length === 0) return [node.id];
  return node.children.flatMap(collectLeafCategoryIds);
}

/** Verilen kategori ID'si icin filtre kapsamini cozer (ust kategori = tum altlar) */
export function resolveCategoryFilterIds(
  categoryId: string,
  categories: CategoryRow[],
): string[] {
  const tree = buildCategoryTree(categories);
  const find = (nodes: CategoryTreeNode[]): CategoryTreeNode | null => {
    for (const n of nodes) {
      if (n.id === categoryId) return n;
      const found = find(n.children);
      if (found) return found;
    }
    return null;
  };

  const node = find(tree);
  if (!node) return [categoryId];
  if (node.children.length === 0) return [node.id];
  // Ust kategoriye dogrudan atanmis urunler de kapsanir
  return [node.id, ...collectLeafCategoryIds(node)];
}

/** Dropdown icin duz, girintili liste */
export function flattenCategoryTree(
  tree: CategoryTreeNode[],
  depth = 0,
): Array<CategoryTreeNode & { depth: number }> {
  const result: Array<CategoryTreeNode & { depth: number }> = [];
  for (const node of tree) {
    result.push({ ...node, depth });
    if (node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, depth + 1));
    }
  }
  return result;
}
