/**
 * AI Usage Monitoring Library
 * Track AI usage to stay within Cloudflare Workers AI free tier limits
 * Free tier: 10,000 neurons/day
 */

import { generateId } from './router';

// Estimated neuron usage per operation
const NEURON_ESTIMATES: Record<string, number> = {
  'generate-seo': 500,
  'categorize': 50,
  'suggest-price': 200,
  'analyze-photo': 500,
  'generate-insights': 500,
  'suggest-split': 100,
  'enhance-description': 300
};

const FREE_TIER_LIMIT = 10000; // neurons per day
const WARNING_THRESHOLD = 0.8; // 80% of limit

/**
 * Log AI usage to database
 */
export async function logAIUsage(
  db: D1Database,
  endpoint: string,
  tokensUsed: number
): Promise<void> {
  const id = generateId('ai');

  await db
    .prepare('INSERT INTO ai_usage (id, endpoint, tokens_used) VALUES (?, ?, ?)')
    .bind(id, endpoint, tokensUsed)
    .run();
}

/**
 * Get today's AI usage
 */
export async function getTodayUsage(db: D1Database): Promise<{
  totalNeurons: number;
  percentUsed: number;
  remaining: number;
  isWarning: boolean;
  isExceeded: boolean;
}> {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const result = await db
    .prepare(`
      SELECT SUM(tokens_used) as total
      FROM ai_usage
      WHERE created_at >= ? AND created_at < ?
    `)
    .bind(today, tomorrowStr)
    .first();

  const totalNeurons = (result as any)?.total || 0;
  const percentUsed = (totalNeurons / FREE_TIER_LIMIT) * 100;
  const remaining = Math.max(0, FREE_TIER_LIMIT - totalNeurons);

  return {
    totalNeurons,
    percentUsed: Math.round(percentUsed * 100) / 100,
    remaining,
    isWarning: percentUsed >= WARNING_THRESHOLD * 100,
    isExceeded: totalNeurons >= FREE_TIER_LIMIT
  };
}

/**
 * Get usage breakdown by endpoint
 */
export async function getUsageBreakdown(
  db: D1Database,
  startDate?: string,
  endDate?: string
): Promise<Array<{ endpoint: string; count: number; totalNeurons: number }>> {
  const today = new Date().toISOString().split('T')[0];
  const start = startDate || today;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const end = endDate || tomorrow.toISOString().split('T')[0];

  const result = await db
    .prepare(`
      SELECT
        endpoint,
        COUNT(*) as count,
        SUM(tokens_used) as total_neurons
      FROM ai_usage
      WHERE created_at >= ? AND created_at < ?
      GROUP BY endpoint
      ORDER BY total_neurons DESC
    `)
    .bind(start, end)
    .all();

  return (result.results || []).map((row: any) => ({
    endpoint: row.endpoint,
    count: row.count,
    totalNeurons: row.total_neurons
  }));
}

/**
 * Check if AI request should be allowed
 */
export async function canUseAI(
  db: D1Database,
  endpoint: string
): Promise<{
  allowed: boolean;
  reason?: string;
  usage?: any;
}> {
  const usage = await getTodayUsage(db);

  if (usage.isExceeded) {
    return {
      allowed: false,
      reason: `Daily AI quota exceeded (${usage.totalNeurons}/${FREE_TIER_LIMIT} neurons used). Try again tomorrow.`,
      usage
    };
  }

  const estimatedCost = NEURON_ESTIMATES[endpoint] || 100;

  if (usage.totalNeurons + estimatedCost > FREE_TIER_LIMIT) {
    return {
      allowed: false,
      reason: `This request would exceed daily AI quota. ${usage.remaining} neurons remaining, ${estimatedCost} needed.`,
      usage
    };
  }

  return {
    allowed: true,
    usage
  };
}

/**
 * Get estimated cost for an AI operation
 */
export function getEstimatedCost(endpoint: string): number {
  return NEURON_ESTIMATES[endpoint] || 100;
}

/**
 * Clean up old AI usage records (keep last 90 days)
 */
export async function cleanupOldUsage(db: D1Database): Promise<number> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = ninetyDaysAgo.toISOString();

  const result = await db
    .prepare('DELETE FROM ai_usage WHERE created_at < ?')
    .bind(cutoffDate)
    .run();

  return result.meta?.changes || 0;
}

/**
 * Get AI usage summary for reports
 */
export async function getUsageSummary(db: D1Database): Promise<{
  today: any;
  thisWeek: number;
  thisMonth: number;
  breakdown: any[];
}> {
  const today = await getTodayUsage(db);

  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  // This week
  const weekResult = await db
    .prepare(`
      SELECT SUM(tokens_used) as total
      FROM ai_usage
      WHERE created_at >= ?
    `)
    .bind(weekAgo.toISOString())
    .first();

  // This month
  const monthResult = await db
    .prepare(`
      SELECT SUM(tokens_used) as total
      FROM ai_usage
      WHERE created_at >= ?
    `)
    .bind(monthAgo.toISOString())
    .first();

  const breakdown = await getUsageBreakdown(db);

  return {
    today,
    thisWeek: (weekResult as any)?.total || 0,
    thisMonth: (monthResult as any)?.total || 0,
    breakdown
  };
}
