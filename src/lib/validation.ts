/**
 * Validation Library
 * Provides reusable validation helpers for API endpoints
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate that required fields are present and non-empty
 */
export function validateRequired(
  data: Record<string, any>,
  fields: string[]
): void {
  const missing: string[] = [];

  for (const field of fields) {
    const value = data[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missing }
    );
  }
}

/**
 * Validate XOR constraint: exactly one of two fields must be present
 */
export function validateXOR(
  data: Record<string, any>,
  field1: string,
  field2: string
): void {
  const hasField1 = data[field1] !== undefined && data[field1] !== null;
  const hasField2 = data[field2] !== undefined && data[field2] !== null;

  if (!hasField1 && !hasField2) {
    throw new ValidationError(
      `Exactly one of ${field1} or ${field2} must be provided`,
      { field1, field2 }
    );
  }

  if (hasField1 && hasField2) {
    throw new ValidationError(
      `Cannot provide both ${field1} and ${field2}`,
      { field1, field2 }
    );
  }
}

/**
 * Validate vehicle deduction mutual exclusivity
 */
export function validateVehicleDeduction(
  mileage?: number | null,
  actual?: number | null
): void {
  const hasMileage = mileage !== undefined && mileage !== null;
  const hasActual = actual !== undefined && actual !== null;

  if (hasMileage && hasActual) {
    throw new ValidationError(
      'Cannot use both mileage and actual expense deduction methods',
      { mileage, actual }
    );
  }

  if (hasMileage && mileage < 0) {
    throw new ValidationError('Mileage cannot be negative', { mileage });
  }

  if (hasActual && actual < 0) {
    throw new ValidationError('Actual expenses cannot be negative', { actual });
  }
}

/**
 * Validate that a value is non-negative
 */
export function validatePositive(
  value: number | undefined | null,
  fieldName: string
): void {
  if (value !== undefined && value !== null && value < 0) {
    throw new ValidationError(
      `${fieldName} cannot be negative`,
      { [fieldName]: value }
    );
  }
}

/**
 * Validate date range (start <= end)
 */
export function validateDateRange(
  start: string | undefined | null,
  end: string | undefined | null
): void {
  if (!start || !end) {
    return; // Allow optional date ranges
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime())) {
    throw new ValidationError('Invalid start date', { start });
  }

  if (isNaN(endDate.getTime())) {
    throw new ValidationError('Invalid end date', { end });
  }

  if (startDate > endDate) {
    throw new ValidationError(
      'Start date must be before or equal to end date',
      { start, end }
    );
  }
}

/**
 * Validate rate is between 0 and 1 (inclusive)
 */
export function validateRate(
  value: number | undefined | null,
  fieldName: string
): void {
  if (value !== undefined && value !== null) {
    if (value < 0 || value > 1) {
      throw new ValidationError(
        `${fieldName} must be between 0 and 1`,
        { [fieldName]: value }
      );
    }
  }
}

/**
 * Validate status enum value
 */
export function validateEnum(
  value: string | undefined | null,
  fieldName: string,
  allowedValues: string[]
): void {
  if (value !== undefined && value !== null) {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        { [fieldName]: value, allowedValues }
      );
    }
  }
}

/**
 * Validate SKU uniqueness (requires database query)
 * Returns true if SKU is available (unique or null)
 */
export async function validateSKUUnique(
  db: D1Database,
  sku: string | null | undefined,
  excludeItemId?: string
): Promise<boolean> {
  if (!sku) {
    return true; // SKU is optional
  }

  let query = 'SELECT id FROM items WHERE sku = ?';
  const params: any[] = [sku];

  if (excludeItemId) {
    query += ' AND id != ?';
    params.push(excludeItemId);
  }

  const result = await db.prepare(query).bind(...params).first();
  return result === null;
}

/**
 * Validate expense splits sum correctly (allow small rounding errors)
 */
export function validateExpenseSplits(
  inventory: number,
  operations: number,
  other: number,
  amount: number
): void {
  validatePositive(inventory, 'split_inventory');
  validatePositive(operations, 'split_operations');
  validatePositive(other, 'split_other');

  const total = inventory + operations + other;
  const epsilon = 0.01; // Allow 1 cent rounding error

  if (Math.abs(total - amount) > epsilon) {
    throw new ValidationError(
      'Expense splits must sum to total amount',
      { inventory, operations, other, amount, total }
    );
  }
}

/**
 * Validate sale has at least one item
 */
export function validateSaleItems(items: any[]): void {
  if (!items || items.length === 0) {
    throw new ValidationError('Sale must include at least one item');
  }

  for (const item of items) {
    if (!item.item_id) {
      throw new ValidationError('Each sale item must have an item_id');
    }
    if (!item.quantity || item.quantity <= 0) {
      throw new ValidationError('Each sale item must have a positive quantity');
    }
  }
}

/**
 * Validate confidence score is between 0 and 1
 */
export function validateConfidence(
  confidence: number | undefined | null
): void {
  if (confidence !== undefined && confidence !== null) {
    if (confidence < 0 || confidence > 1) {
      throw new ValidationError(
        'Confidence score must be between 0 and 1',
        { confidence }
      );
    }
  }
}
