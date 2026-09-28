/**
 * Standardized API response types for consistent response shapes across all endpoints.
 */

export interface ApiResponse<T> {
  success: boolean;
  timestamp: string;
  data?: T;
  error?: string;
  message?: string;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  provider?: string;
  count?: number;
  page?: number;
  pageSize?: number;
  total?: number;
  [key: string]: any;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    provider?: string;
    count: number;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  success: false;
  timestamp: string;
  error: string;
  code?: string;
  details?: any;
}

/**
 * Creates a successful response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): ApiResponse<T> {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    data,
    meta,
  };
}

/**
 * Creates a paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
  meta?: Partial<ResponseMeta>
): PaginatedResponse<T> {
  return {
    success: true,
    timestamp: new Date().toISOString(),
    data,
    meta: {
      count: data.length,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      ...meta,
    },
  };
}

/**
 * Creates an error response
 */
export function createErrorResponse(
  error: string,
  code?: string,
  details?: any
): ErrorResponse {
  return {
    success: false,
    timestamp: new Date().toISOString(),
    error,
    code,
    details,
  };
}

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: ApiResponse<any>): response is ErrorResponse {
  return response.success === false;
}