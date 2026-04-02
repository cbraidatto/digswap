/**
 * Shared types and utilities for server actions.
 *
 * All server actions should return ActionResult<T> instead of throwing.
 * This ensures callers always get a structured response and never see
 * unhandled exceptions as white screens.
 */

export type ActionResult<T = Record<string, unknown>> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Create a typed error result for server actions.
 */
export function actionError(message: string): { success: false; error: string } {
  return { success: false, error: message };
}

/**
 * Create a typed success result for server actions.
 */
export function actionSuccess<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}
