// Public surface of the inventory domain. Consumers (admin inventory page,
// components) must import from here rather than reaching into ./schemas,
// ./repository, ./service, or ./actions directly.

export type { MovementType, ProductStock, StockMovement, StockMovementInput } from "./schemas";

export { DEFAULT_LOW_STOCK_THRESHOLD, isProductId, MOVEMENT_TYPES } from "./schemas";

export { getCurrentStock, getLowStockProducts, getMovementHistory, type MovementHistory } from "./service";

export { recordStockMovement, type InventoryActionState } from "./actions";
