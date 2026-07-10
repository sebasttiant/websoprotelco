// Public surface of the catalog domain. Consumers (storefront pages, admin pages,
// components) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.

export type {
  CatalogDeleteInput,
  CategoryAdminInput,
  CategorySummary,
  ProductAdminInput,
  ProductDetail,
  ProductListFilters,
  ProductSort,
  ProductSummary,
} from "./schemas";

export {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  updateCategory,
  updateProduct,
  type AdminActionState,
} from "./actions";

export {
  getCategories,
  getFeaturedProducts,
  getProductBySlug,
  getProducts,
} from "./service";
