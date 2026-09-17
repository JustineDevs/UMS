export type AdminPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export function buildAdminPagination(page: number, pageSize: number, total: number): AdminPagination {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safeTotal = Math.max(0, Math.floor(total));
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  return { page: safePage, pageSize: safePageSize, total: safeTotal, totalPages, hasNextPage: safePage < totalPages, hasPreviousPage: safePage > 1 };
}
