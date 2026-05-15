export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
}

export type ApiRecord = Record<string, any>;

export interface ApiError {
  error: {
    statusCode: number;
    message: string;
    details?: unknown;
  };
}
