// Public surface of the catalog domain. Consumers (storefront pages, admin pages,
// components) must import from here rather than reaching into ./schemas, ./repository,
// ./service, or ./actions directly.

export type {
  CatalogDeleteInput,
  CategoryAdminDetail,
  CategoryAdminInput,
  CategoryAdminSummary,
  CategoryOption,
  CategorySummary,
  ProductAdminDetail,
  ProductAdminInput,
  ProductAdminListFilters,
  ProductAdminListResult,
  ProductAdminSummary,
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
  getCategoriesForAdmin,
  getCategoryByIdForAdmin,
  getCategoryOptions,
  getCategoryOptionsExcluding,
  getFeaturedProducts,
  getProductByIdForAdmin,
  getProductBySlug,
  getProducts,
  getProductsForAdmin,
} from "./service";
