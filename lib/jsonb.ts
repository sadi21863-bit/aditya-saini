/**
 * lib/jsonb.ts
 * 
 * Utilities for safely merging JSONB columns without overwriting entire objects.
 * Used for updating idea metadata fields incrementally.
 */

import { sql } from "drizzle-orm";

/**
 * Merge new data into existing JSONB column
 * Preserves existing fields, only updates specified keys
 * 
 * @param column - The JSONB column reference
 * @param newData - New data to merge in
 * @returns SQL expression for the merge operation
 */
export function jsonbMerge(column: any, newData: Record<string, any>) {
    return sql`${column} || ${JSON.stringify(newData)}::jsonb`;
}

/**
 * Merge new data into JSONB column, or initialize if null
 * 
 * @param column - The JSONB column reference
 * @param newData - New data to merge in
 * @param defaultValue - Default value if column is null
 * @returns SQL expression for the merge/init operation
 */
export function jsonbMergeOrInit(
    column: any,
    newData: Record<string, any>,
    defaultValue: Record<string, any> = {}
) {
    return sql`COALESCE(${column}, ${JSON.stringify(defaultValue)}::jsonb) || ${JSON.stringify(newData)}::jsonb`;
}
