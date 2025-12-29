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
