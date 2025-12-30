/**
 * eBay OAuth Integration Library
 *
 * Handles OAuth 2.0 flow for eBay API access
 * Stores tokens in the integrations table
 *
 * @see https://developer.ebay.com/api-docs/static/oauth-tokens.html
 */

import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  EBAY_APP_ID: string;
  EBAY_CERT_ID: string;
  EBAY_RU_NAME: string;
}

export interface EbayTokens {
  access_token: string;
  refresh_token?: string;
  token_expiry?: string;
  scopes?: string;
}

export interface EbayTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;  // seconds
  token_type: string;
}

/**
 * Fetch eBay OAuth tokens from database
 * @param db D1 Database instance
 * @returns EbayTokens or null if not found
 */
export async function getEbayTokens(db: D1Database): Promise<EbayTokens | null> {
  const result = await db
    .prepare('SELECT access_token, refresh_token, token_expiry, scopes FROM integrations WHERE provider = ?')
    .bind('ebay')
    .first<EbayTokens>();

  if (!result) {
    return null;
  }

  // Check if token is expired
  if (result.token_expiry) {
    const expiry = new Date(result.token_expiry);
    const now = new Date();

    // If expired, return null (caller should handle re-authentication)
    if (expiry <= now) {
      console.warn('eBay token expired:', result.token_expiry);
      return null;
    }
  }

  return result;
}

/**
 * Exchange OAuth authorization code for access/refresh tokens
 *
 * @param env Environment with EBAY_APP_ID, EBAY_CERT_ID, EBAY_RU_NAME
 * @param code Authorization code from eBay OAuth callback
 * @returns Token response from eBay
 */
export async function exchangeCodeForTokens(
  env: Env,
  code: string
): Promise<EbayTokenResponse> {
  // eBay OAuth token endpoint
  const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';

  // Create Basic Auth header: Base64(app_id:cert_id)
  const credentials = `${env.EBAY_APP_ID}:${env.EBAY_CERT_ID}`;
  const basicAuth = btoa(credentials);

  // Build form-encoded body
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: env.EBAY_RU_NAME,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay token exchange failed: ${response.status} ${errorText}`);
  }

  const tokenData: EbayTokenResponse = await response.json();
  return tokenData;
}

/**
 * Refresh an expired eBay access token using refresh token
 *
 * @param env Environment with EBAY_APP_ID, EBAY_CERT_ID
 * @param refreshToken Refresh token from database
 * @returns New token response from eBay
 */
export async function refreshEbayToken(
  env: Env,
  refreshToken: string
): Promise<EbayTokenResponse> {
  const tokenUrl = 'https://api.ebay.com/identity/v1/oauth2/token';

  const credentials = `${env.EBAY_APP_ID}:${env.EBAY_CERT_ID}`;
  const basicAuth = btoa(credentials);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`eBay token refresh failed: ${response.status} ${errorText}`);
  }

  const tokenData: EbayTokenResponse = await response.json();
  return tokenData;
}

/**
 * Save or update eBay tokens in database
 *
 * @param db D1 Database instance
 * @param tokens Token response from eBay
 * @param scopes Optional array of granted scopes
 */
export async function saveEbayTokens(
  db: D1Database,
  tokens: EbayTokenResponse,
  scopes?: string[]
): Promise<void> {
  // Calculate token expiry timestamp
  const expiryDate = new Date();
  expiryDate.setSeconds(expiryDate.getSeconds() + tokens.expires_in);
  const tokenExpiry = expiryDate.toISOString();

  // Serialize scopes as JSON
  const scopesJson = scopes ? JSON.stringify(scopes) : null;

  // Upsert tokens (SQLite syntax: INSERT OR REPLACE)
  await db
    .prepare(`
      INSERT INTO integrations (provider, access_token, refresh_token, token_expiry, scopes, updated_at)
      VALUES ('ebay', ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(provider) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expiry = excluded.token_expiry,
        scopes = excluded.scopes,
        updated_at = excluded.updated_at
    `)
    .bind(
      tokens.access_token,
      tokens.refresh_token || null,
      tokenExpiry,
      scopesJson
    )
    .run();
}

/**
 * Make an authenticated request to eBay API
 *
 * @param db D1 Database instance
 * @param env Environment variables
 * @param path eBay API path (e.g., '/sell/inventory/v1/inventory_item')
 * @param method HTTP method
 * @param body Optional request body
 * @returns Response from eBay API
 */
export async function fetchFromEbay(
  db: D1Database,
  env: Env,
  path: string,
  method: string = 'GET',
  body?: any
): Promise<Response> {
  // Get tokens from database
  let tokens = await getEbayTokens(db);

  // If no tokens or expired, throw error
  if (!tokens) {
    throw new Error('eBay not connected or token expired. Please re-authenticate.');
  }

  // Build full URL (production eBay API)
  const baseUrl = 'https://api.ebay.com';
  const url = `${baseUrl}${path}`;

  // Make request with Bearer token
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${tokens.access_token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // If 401 Unauthorized, token may have expired despite our check
  if (response.status === 401 && tokens.refresh_token) {
    console.log('eBay token expired, attempting refresh...');

    try {
      // Try to refresh token
      const newTokens = await refreshEbayToken(env, tokens.refresh_token);

      // Save new tokens
      await saveEbayTokens(db, newTokens);

      // Retry original request with new token
      headers['Authorization'] = `Bearer ${newTokens.access_token}`;
      const retryResponse = await fetch(url, options);
      return retryResponse;
    } catch (error) {
      throw new Error('Failed to refresh eBay token. Please re-authenticate.');
    }
  }

  return response;
}

/**
 * Remove eBay integration from database
 *
 * @param db D1 Database instance
 */
export async function disconnectEbay(db: D1Database): Promise<void> {
  await db
    .prepare('DELETE FROM integrations WHERE provider = ?')
    .bind('ebay')
    .run();
}

/**
 * Check if eBay is connected and token is valid
 *
 * @param db D1 Database instance
 * @returns true if connected with valid token
 */
export async function isEbayConnected(db: D1Database): Promise<boolean> {
  const tokens = await getEbayTokens(db);
  return tokens !== null;
}

// ============================================================================
// EBAY MARKET RESEARCH & VALUATION
// ============================================================================

/**
 * Search eBay completed listings for market research
 * Returns pricing data from sold items
 */
export async function searchCompletedListings(
  db: D1Database,
  env: Env,
  query: string,
  category?: string
): Promise<{
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  soldCount: number;
  listings: Array<{ title: string; price: number; condition: string; soldDate: string; }>;
}> {
  // eBay Browse API filter for completed/sold items
  const filter = 'buyingOptions:{FIXED_PRICE},itemEndDate:[2023-01-01T00:00:00.000Z..],priceCurrency:USD';
  const categoryFilter = category ? `&category_ids=${category}` : '';

  const path = `/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&filter=${filter}${categoryFilter}&sort=price&limit=50`;

  const response = await fetchFromEbay(db, env, path, 'GET');

  if (!response.ok) {
    throw new Error(`eBay search failed: ${response.status}`);
  }

  const data = await response.json();
  const listings = (data.itemSummaries || []).map((item: any) => ({
    title: item.title,
    price: parseFloat(item.price?.value || 0),
    condition: item.condition || 'Unknown',
    soldDate: item.itemEndDate || null
  }));

  const prices = listings.map((l: any) => l.price).filter((p: number) => p > 0);

  if (prices.length === 0) {
    return { averagePrice: 0, minPrice: 0, maxPrice: 0, soldCount: 0, listings: [] };
  }

  const averagePrice = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;

  return {
    averagePrice: Math.round(averagePrice * 100) / 100,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    soldCount: prices.length,
    listings: listings.slice(0, 10)
  };
}

/**
 * Get eBay market valuation based on item name (text-based, FREE)
 * Uses eBay Browse API to search completed listings and calculate pricing
 */
export async function getTextValuation(
  db: D1Database,
  env: Env,
  itemName: string,
  category?: string
): Promise<{
  suggestedPrice: number;
  priceRange: { min: number; max: number };
  confidence: number;
  marketData: any;
}> {
  const marketData = await searchCompletedListings(db, env, itemName, category);

  // Suggest 5% below average to price competitively
  const suggestedPrice = marketData.averagePrice * 0.95;

  // Calculate confidence based on sample size
  let confidence = 0.5; // Default: low confidence
  if (marketData.soldCount >= 20) confidence = 0.9; // High confidence
  else if (marketData.soldCount >= 10) confidence = 0.75; // Medium-high
  else if (marketData.soldCount >= 5) confidence = 0.6; // Medium

  return {
    suggestedPrice: Math.round(suggestedPrice * 100) / 100,
    priceRange: {
      min: marketData.minPrice,
      max: marketData.maxPrice
    },
    confidence,
    marketData
  };
}

/**
 * Get eBay market valuation based on photo (photo-based, 800 neurons)
 * Uses AI to analyze photo, then searches eBay for pricing
 */
export async function getPhotoValuation(
  db: D1Database,
  env: Env & { AI: any },
  photoData: ArrayBuffer
): Promise<{
  suggestedPrice: number;
  priceRange: { min: number; max: number };
  confidence: number;
  detectedItem: string;
  marketData: any;
}> {
  // Use AI to analyze photo and detect item details
  const { analyzePhoto } = await import('./ai');
  const analysis = await analyzePhoto(env.AI, photoData);

  // Search eBay using detected item name
  const marketData = await searchCompletedListings(
    db,
    env,
    analysis.detectedItem || 'unknown item',
    analysis.suggestedCategory
  );

  const suggestedPrice = marketData.averagePrice * 0.95;

  // Combine AI confidence with market data confidence
  const baseConfidence = marketData.soldCount >= 10 ? 0.75 : 0.5;
  const confidence = Math.min(baseConfidence + (analysis.confidence * 0.2), 1.0);

  return {
    suggestedPrice: Math.round(suggestedPrice * 100) / 100,
    priceRange: {
      min: marketData.minPrice,
      max: marketData.maxPrice
    },
    confidence,
    detectedItem: analysis.detectedItem || 'Unknown',
    marketData
  };
}

// ============================================================================
// EBAY IMPORT FUNCTIONS
// ============================================================================

/**
 * Fetch active eBay listings and convert to items format
 * Checks for duplicates via ebay_listing_id to prevent re-importing
 */
export async function fetchEbayListings(
  db: D1Database,
  env: Env
): Promise<{
  listings: Array<{
    sku: string;
    name: string;
    description: string;
    cost: number;
    category: string;
    status: string;
    ebay_listing_id: string;
    ebay_status: string;
    price: number;
    quantity: number;
  }>;
  newCount: number;
  duplicateCount: number;
}> {
  // Fetch all inventory items from eBay
  const response = await fetchFromEbay(
    db,
    env,
    '/sell/inventory/v1/inventory_item?limit=100',
    'GET'
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch eBay listings: ${response.status}`);
  }

  const data = await response.json();
  const inventoryItems = data.inventoryItems || [];

  // Get existing ebay_listing_ids to detect duplicates
  const existingListingsResult = await db
    .prepare('SELECT ebay_listing_id FROM items WHERE ebay_listing_id IS NOT NULL')
    .all();

  const existingIds = new Set(
    existingListingsResult.results.map((r: any) => r.ebay_listing_id)
  );

  const listings = [];
  let duplicateCount = 0;

  for (const item of inventoryItems) {
    // Get the offer to retrieve price and listing ID
    const offerResponse = await fetchFromEbay(
      db,
      env,
      `/sell/inventory/v1/offer?sku=${item.sku}`,
      'GET'
    );

    let price = 0;
    let listingId = item.sku;
    let ebayStatus = 'active';

    if (offerResponse.ok) {
      const offerData = await offerResponse.json();
      const offer = offerData.offers?.[0];

      if (offer) {
        price = parseFloat(offer.pricingSummary?.price?.value || 0);
        listingId = offer.offerId || item.sku;
        ebayStatus = offer.status === 'PUBLISHED' ? 'active' : 'draft';
      }
    }

    // Check if already imported
    if (existingIds.has(listingId)) {
      duplicateCount++;
      continue;
    }

    listings.push({
      sku: item.sku,
      name: item.product?.title || 'Untitled Item',
      description: item.product?.description || '',
      cost: 0, // eBay doesn't provide cost
      category: item.product?.aspects?.Category?.[0] || 'Uncategorized',
      status: 'Listed',
      ebay_listing_id: listingId,
      ebay_status: ebayStatus,
      price,
      quantity: item.availability?.shipToLocationAvailability?.quantity || 0
    });
  }

  return {
    listings,
    newCount: listings.length,
    duplicateCount
  };
}

/**
 * Fetch eBay orders (sales) within a date range
 * Auto-matches to items via ebay_listing_id
 */
export async function fetchEbayOrders(
  db: D1Database,
  env: Env,
  dateRange?: { start: string; end: string }
): Promise<{
  sales: Array<{
    order_number: string;
    sale_date: string;
    platform: string;
    gross_amount: number;
    platform_fees: number;
    shipping_cost: number;
    net_amount: number;
    profit: number;
    item_ids: number[];
    ebay_listing_id?: string;
  }>;
  matchedCount: number;
  orphanedCount: number;
}> {
  // Build date filter for eBay API
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  const startDate = dateRange?.start || defaultStart.toISOString();
  const endDate = dateRange?.end || now.toISOString();

  // Fetch orders from eBay
  const filter = `creationdate:[${startDate}..${endDate}]`;
  const response = await fetchFromEbay(
    db,
    env,
    `/sell/fulfillment/v1/order?filter=${encodeURIComponent(filter)}&limit=100`,
    'GET'
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch eBay orders: ${response.status}`);
  }

  const data = await response.json();
  const orders = data.orders || [];

  // Get all items with ebay_listing_id for matching
  const itemsResult = await db
    .prepare('SELECT id, ebay_listing_id FROM items WHERE ebay_listing_id IS NOT NULL')
    .all();

  const listingIdToItemId = new Map(
    itemsResult.results.map((r: any) => [r.ebay_listing_id, r.id])
  );

  const sales = [];
  let matchedCount = 0;
  let orphanedCount = 0;

  for (const order of orders) {
    const lineItems = order.lineItems || [];
    const itemIds: number[] = [];
    let ebayListingId: string | undefined;

    // Try to match line items to local items
    for (const lineItem of lineItems) {
      const listingId = lineItem.legacyItemId || lineItem.lineItemId;
      if (listingId && listingIdToItemId.has(listingId)) {
        itemIds.push(listingIdToItemId.get(listingId)!);
        ebayListingId = listingId;
      }
    }

    const totalPrice = parseFloat(order.pricingSummary?.total?.value || 0);
    const fees = parseFloat(order.pricingSummary?.totalFee?.value || 0);
    const shipping = parseFloat(order.pricingSummary?.deliveryCost?.value || 0);
    const netAmount = totalPrice - fees;

    // Calculate profit if we can match to an item with cost
    let profit = 0;
    if (itemIds.length > 0) {
      const itemResult = await db
        .prepare('SELECT cost FROM items WHERE id = ?')
        .bind(itemIds[0])
        .first<{ cost: number }>();

      if (itemResult?.cost) {
        profit = netAmount - itemResult.cost - shipping;
      }
      matchedCount++;
    } else {
      orphanedCount++;
    }

    sales.push({
      order_number: order.orderId,
      sale_date: order.creationDate,
      platform: 'eBay',
      gross_amount: totalPrice,
      platform_fees: fees,
      shipping_cost: shipping,
      net_amount: netAmount,
      profit,
      item_ids: itemIds,
      ebay_listing_id: ebayListingId
    });
  }

  return {
    sales,
    matchedCount,
    orphanedCount
  };
}

// ============================================================================
// EBAY LISTING CREATION
// ============================================================================

/**
 * Create eBay draft listing
 * Creates inventory item and unpublished offer on eBay
 */
export async function createEbayDraftListing(
  db: D1Database,
  env: Env,
  draftData: {
    sku: string;
    title: string;
    price: number;
    quantity: number;
    condition: 'NEW' | 'USED_EXCELLENT' | 'USED_GOOD' | 'FOR_PARTS_OR_NOT_WORKING';
    description?: string;
    categoryId?: string;
  }
): Promise<{
  success: boolean;
  listingId?: string;
  inventoryItemId?: string;
  offerId?: string;
  draftUrl?: string;
  error?: string;
}> {
  try {
    // Step 1: Create or update inventory item
    const inventoryItemPath = `/sell/inventory/v1/inventory_item/${draftData.sku}`;
    const inventoryItemPayload = {
      availability: {
        shipToLocationAvailability: {
          quantity: draftData.quantity
        }
      },
      condition: draftData.condition,
      product: {
        title: draftData.title,
        description: draftData.description || draftData.title,
        aspects: {}
      }
    };

    const inventoryResponse = await fetchFromEbay(
      db,
      env,
      inventoryItemPath,
      'PUT',
      inventoryItemPayload
    );

    if (!inventoryResponse.ok) {
      const error = await inventoryResponse.text();
      throw new Error(`Failed to create inventory item: ${error}`);
    }

    // Step 2: Create offer (draft/unpublished)
    const offerPayload = {
      sku: draftData.sku,
      marketplaceId: 'EBAY_US',
      format: 'FIXED_PRICE',
      availableQuantity: draftData.quantity,
      categoryId: draftData.categoryId || '1', // Default category if not provided
      listingDescription: draftData.description || draftData.title,
      listingDuration: 'GTC', // Good 'Til Cancelled
      pricingSummary: {
        price: {
          value: draftData.price.toString(),
          currency: 'USD'
        }
      },
      merchantLocationKey: 'default', // Uses account's default location
      listingPolicies: {
        // These would need to be configured per account
        // For now, using defaults - user will set these in eBay UI
      }
    };

    const offerResponse = await fetchFromEbay(
      db,
      env,
      '/sell/inventory/v1/offer',
      'POST',
      offerPayload
    );

    if (!offerResponse.ok) {
      const error = await offerResponse.text();
      throw new Error(`Failed to create offer: ${error}`);
    }

    const offerData = await offerResponse.json();
    const offerId = offerData.offerId;

    // Draft URL for user to review/publish
    const draftUrl = `https://www.ebay.com/sh/lst/drafts`;

    return {
      success: true,
      listingId: offerId,
      inventoryItemId: draftData.sku,
      offerId,
      draftUrl
    };
  } catch (error: any) {
    console.error('eBay draft creation failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
