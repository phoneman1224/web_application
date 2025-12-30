/**
 * API Request and Response Type Definitions
 * Provides type safety for all API endpoints
 */

// ============================================================================
// DATABASE ENTITY TYPES
// ============================================================================

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  cost: number;
  bin_location?: string;
  photos?: string; // JSON string of array
  category?: string;
  status: 'Unlisted' | 'Draft' | 'Listed' | 'Sold';
  lifecycle_stage: 'Captured' | 'Prepared' | 'Listed' | 'Sold';
  sold_price?: number;
  sold_date?: string;
  ai_suggested_category?: string;
  ai_category_confidence?: number;
  ebay_listing_id?: string;
  ebay_status?: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  order_number?: string;
  platform: string;
  gross_amount: number;
  platform_fees: number;
  promotion_discount: number;
  shipping_cost: number;
  cost_of_goods: number;
  florida_tax_collected: number;
  ebay_tax_collected: number;
  federal_tax_estimate: number;
  profit: number;
  sale_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SaleWithItems extends Sale {
  items: Array<{
    sale_id: string;
    item_id: string;
    quantity: number;
    item_name: string;
    item_cost: number;
  }>;
}

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  split_inventory?: number;
  split_operations?: number;
  split_other?: number;
  receipt_key?: string;
  vehicle_mileage?: number;
  vehicle_actual?: number;
  expense_date: string;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  name: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LotWithItems extends Lot {
  items: Array<{
    lot_id: string;
    item_id: string;
    quantity: number;
    item_name: string;
    item_cost: number;
    item_category?: string;
  }>;
  total_cost: number;
}

export interface PricingDraft {
  id: string;
  item_id?: string;
  lot_id?: string;
  suggested_price: number;
  seo_title?: string;
  seo_description?: string;
  confidence_score?: number;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface FeeProfile {
  id: string;
  platform: string;
  fee_rate: number;
  description?: string;
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

export interface CreateItemRequest {
  name: string;
  description?: string;
  cost?: number;
  bin_location?: string;
  category?: string;
  status?: Item['status'];
  lifecycle_stage?: Item['lifecycle_stage'];
  photos?: string;
}

export interface UpdateItemRequest extends Partial<CreateItemRequest> {
  sold_price?: number;
  sold_date?: string;
  ebay_listing_id?: string;
  ebay_status?: string;
}

export interface CreateSaleRequest {
  order_number?: string;
  platform: string;
  gross_amount: number;
  platform_fees?: number;
  promotion_discount?: number;
  shipping_cost?: number;
  sale_date: string;
  notes?: string;
  items: Array<{
    item_id: string;
    quantity: number;
  }>;
}

export interface UpdateSaleRequest extends Partial<CreateSaleRequest> {}

export interface CreateExpenseRequest {
  name: string;
  category: string;
  amount: number;
  split_inventory?: number;
  split_operations?: number;
  split_other?: number;
  receipt_key?: string;
  vehicle_mileage?: number;
  vehicle_actual?: number;
  expense_date: string;
}

export interface UpdateExpenseRequest extends Partial<CreateExpenseRequest> {}

export interface CreateLotRequest {
  name: string;
  notes?: string;
  items?: Array<{
    item_id: string;
    quantity: number;
  }>;
}

export interface UpdateLotRequest extends Partial<CreateLotRequest> {}

export interface CreatePricingDraftRequest {
  item_id?: string;
  lot_id?: string;
  suggested_price: number;
  seo_title?: string;
  seo_description?: string;
  confidence_score?: number;
}

export interface UpdatePricingDraftRequest extends Partial<CreatePricingDraftRequest> {}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: any;
}

export interface ItemsResponse {
  items: Item[];
}

export interface ItemResponse {
  item: Item;
}

export interface SalesResponse {
  sales: SaleWithItems[];
}

export interface SaleResponse {
  sale: SaleWithItems;
}

export interface ExpensesResponse {
  expenses: Expense[];
}

export interface ExpenseResponse {
  expense: Expense;
}

export interface LotsResponse {
  lots: LotWithItems[];
}

export interface LotResponse {
  lot: LotWithItems;
}

export interface PricingDraftsResponse {
  drafts: PricingDraft[];
}

export interface PricingDraftResponse {
  draft: PricingDraft;
}

export interface SettingsResponse {
  settings: Record<string, string>;
}

export interface DashboardResponse {
  mtd_profit: number;
  sales_tax_liability: number;
  ready_drafts: number;
  next_actions: string[];
}

export interface ProfitLossResponse {
  period: string;
  revenue: number;
  cogs: number;
  expenses: number;
  profit: number;
  profit_margin: number;
}

export interface TaxSummaryResponse {
  federal_tax_estimate: number;
  sales_tax_collected: number;
  by_platform: Record<string, number>;
}

// ============================================================================
// AI FEATURE TYPES
// ============================================================================

export interface GenerateSEORequest {
  item_id?: string;
  lot_id?: string;
}

export interface GenerateSEOResponse {
  title: string;
  description: string;
  keywords: string[];
  confidence: number;
}

export interface CategorizeRequest {
  name: string;
  description?: string;
}

export interface CategorizeResponse {
  category: string;
  confidence: number;
}

export interface SuggestPriceRequest {
  item_id?: string;
  lot_id?: string;
}

export interface SuggestPriceResponse {
  suggested_price: number;
  min_price: number;
  max_price: number;
  confidence: number;
}

export interface AnalyzePhotoRequest {
  photo_url: string;
}

export interface AnalyzePhotoResponse {
  item_type: string;
  condition: string;
  category: string;
  confidence: number;
}

export interface AIUsageResponse {
  today: number;
  limit: number;
  remaining: number;
  percentage: number;
}

// ============================================================================
// EBAY INTEGRATION TYPES
// ============================================================================

export interface EbayValuationRequest {
  item_name?: string;
  photo_key?: string;
}

export interface EbayListing {
  title: string;
  price: number;
  condition: string;
  url?: string;
}

export interface EbayValuationResponse {
  average_price: number;
  min_price: number;
  max_price: number;
  confidence: number;
  marketData: {
    listings: EbayListing[];
    total_results: number;
  };
}

export interface CreateEbayDraftRequest {
  title: string;
  price: number;
  condition: string;
  quantity: number;
  description: string;
}

export interface EbayStatusResponse {
  connected: boolean;
  expires_at?: string;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ValidationErrorDetails {
  field: string;
  message: string;
}

export interface ErrorResponse {
  error: string;
  details?: ValidationErrorDetails[] | any;
}
