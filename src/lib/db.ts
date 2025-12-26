/**
 * Database Helper Library
 * Provides reusable CRUD operations for D1 database
 */

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Get a single record by ID
 */
export async function getById<T>(
  db: D1Database,
  table: string,
  id: string
): Promise<T | null> {
  const result = await db
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .bind(id)
    .first();

  return result as T | null;
}

/**
 * Get a single record by ID or throw NotFoundError
 */
export async function getByIdOrThrow<T>(
  db: D1Database,
  table: string,
  id: string
): Promise<T> {
  const result = await getById<T>(db, table, id);

  if (!result) {
    throw new NotFoundError(`${table} with id ${id} not found`);
  }

  return result;
}

/**
 * Get all records from a table with optional filtering
 */
export async function getAll<T>(
  db: D1Database,
  table: string,
  filters?: Record<string, any>
): Promise<T[]> {
  let query = `SELECT * FROM ${table}`;
  const params: any[] = [];

  if (filters && Object.keys(filters).length > 0) {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
  }

  query += ' ORDER BY created_at DESC';

  const result = await db.prepare(query).bind(...params).all();
  return (result.results || []) as T[];
}

/**
 * Insert a new record into a table
 */
export async function insert<T>(
  db: D1Database,
  table: string,
  data: Record<string, any>
): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');

  const query = `
    INSERT INTO ${table} (${keys.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await db.prepare(query).bind(...values).first();

  if (!result) {
    throw new Error(`Failed to insert record into ${table}`);
  }

  return result as T;
}

/**
 * Update an existing record
 */
export async function update<T>(
  db: D1Database,
  table: string,
  id: string,
  data: Record<string, any>
): Promise<T> {
  // Remove id from data if present
  const { id: _, ...updateData } = data;

  // Add updated_at timestamp
  const dataWithTimestamp = {
    ...updateData,
    updated_at: new Date().toISOString()
  };

  const keys = Object.keys(dataWithTimestamp);
  const values = Object.values(dataWithTimestamp);
  const setClause = keys.map(key => `${key} = ?`).join(', ');

  const query = `
    UPDATE ${table}
    SET ${setClause}
    WHERE id = ?
    RETURNING *
  `;

  const result = await db.prepare(query).bind(...values, id).first();

  if (!result) {
    throw new NotFoundError(`${table} with id ${id} not found`);
  }

  return result as T;
}

/**
 * Delete a record by ID
 */
export async function deleteById(
  db: D1Database,
  table: string,
  id: string
): Promise<void> {
  const result = await db
    .prepare(`DELETE FROM ${table} WHERE id = ? RETURNING id`)
    .bind(id)
    .first();

  if (!result) {
    throw new NotFoundError(`${table} with id ${id} not found`);
  }
}

/**
 * Execute a raw query (for complex operations)
 */
export async function executeQuery<T>(
  db: D1Database,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const result = await db.prepare(query).bind(...params).all();
  return (result.results || []) as T[];
}

/**
 * Execute a raw query and return first result
 */
export async function executeQueryFirst<T>(
  db: D1Database,
  query: string,
  params: any[] = []
): Promise<T | null> {
  const result = await db.prepare(query).bind(...params).first();
  return result as T | null;
}

/**
 * Check if a record exists by ID
 */
export async function exists(
  db: D1Database,
  table: string,
  id: string
): Promise<boolean> {
  const result = await db
    .prepare(`SELECT 1 FROM ${table} WHERE id = ? LIMIT 1`)
    .bind(id)
    .first();

  return result !== null;
}

/**
 * Count records in a table with optional filters
 */
export async function count(
  db: D1Database,
  table: string,
  filters?: Record<string, any>
): Promise<number> {
  let query = `SELECT COUNT(*) as count FROM ${table}`;
  const params: any[] = [];

  if (filters && Object.keys(filters).length > 0) {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
  }

  const result = await db.prepare(query).bind(...params).first();
  return (result as any)?.count || 0;
}

/**
 * Get records with date range filtering
 */
export async function getByDateRange<T>(
  db: D1Database,
  table: string,
  dateField: string,
  startDate?: string,
  endDate?: string,
  additionalFilters?: Record<string, any>
): Promise<T[]> {
  let query = `SELECT * FROM ${table}`;
  const params: any[] = [];
  const conditions: string[] = [];

  if (startDate) {
    conditions.push(`${dateField} >= ?`);
    params.push(startDate);
  }

  if (endDate) {
    conditions.push(`${dateField} <= ?`);
    params.push(endDate);
  }

  if (additionalFilters) {
    for (const [key, value] of Object.entries(additionalFilters)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` ORDER BY ${dateField} DESC`;

  const result = await db.prepare(query).bind(...params).all();
  return (result.results || []) as T[];
}

/**
 * Batch insert records (within transaction)
 */
export async function batchInsert<T>(
  db: D1Database,
  table: string,
  records: Record<string, any>[]
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const keys = Object.keys(records[0]);
  const placeholders = keys.map(() => '?').join(', ');

  const statements = records.map(record => {
    const values = keys.map(key => record[key]);
    return db
      .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`)
      .bind(...values);
  });

  await db.batch(statements);
}

/**
 * Get setting value by key
 */
export async function getSetting(
  db: D1Database,
  key: string,
  defaultValue?: string
): Promise<string | null> {
  const result = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first();

  return result ? (result as any).value : (defaultValue || null);
}

/**
 * Update setting value by key
 */
export async function updateSetting(
  db: D1Database,
  key: string,
  value: string
): Promise<void> {
  await db
    .prepare(`
      UPDATE settings
      SET value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE key = ?
    `)
    .bind(value, key)
    .run();
}

/**
 * Get all settings as key-value map
 */
export async function getAllSettings(
  db: D1Database
): Promise<Record<string, string>> {
  const result = await db
    .prepare('SELECT key, value FROM settings')
    .all();

  const settings: Record<string, string> = {};

  for (const row of result.results || []) {
    const r = row as any;
    settings[r.key] = r.value;
  }

  return settings;
}
