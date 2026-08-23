export function shouldFetchNextMedusaPage(input: {
  offset: number;
  pageSize: number;
  rows: number;
  total?: number;
}): boolean {
  if (input.rows === 0) return false;
  if (typeof input.total === "number") {
    return input.offset + input.rows < input.total;
  }
  return input.rows >= input.pageSize;
}

export type MedusaPage<T> = { rows: T[]; total?: number };

/**
 * Fetch a complete result set in bounded parallel batches when the API gives
 * us a count. Unknown-count APIs stay sequential so termination remains exact.
 */
export async function fetchMedusaPages<T>(
  pageSize: number,
  fetchPage: (_offset: number) => Promise<MedusaPage<T>>,
  maxConcurrent = 4,
): Promise<{ pages: T[][]; requestCount: number }> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("pageSize must be a positive integer");
  }
  if (!Number.isInteger(maxConcurrent) || maxConcurrent <= 0) {
    throw new Error("maxConcurrent must be a positive integer");
  }

  const first = await fetchPage(0);
  const pages: T[][] = [first.rows];
  let requestCount = 1;
  if (
    !shouldFetchNextMedusaPage({
      offset: 0,
      pageSize,
      rows: first.rows.length,
      total: first.total,
    })
  ) {
    return { pages, requestCount };
  }

  if (typeof first.total !== "number") {
    let offset = pageSize;
    while (true) {
      const page = await fetchPage(offset);
      requestCount += 1;
      pages.push(page.rows);
      if (
        !shouldFetchNextMedusaPage({
          offset,
          pageSize,
          rows: page.rows.length,
          total: page.total,
        })
      ) {
        break;
      }
      offset += pageSize;
    }
    return { pages, requestCount };
  }

  const totalPages = Math.ceil(first.total / pageSize);
  for (let start = 1; start < totalPages; start += maxConcurrent) {
    const offsets = Array.from(
      { length: Math.min(maxConcurrent, totalPages - start) },
      (_, index) => (start + index) * pageSize,
    );
    const batch = await Promise.all(offsets.map((offset) => fetchPage(offset)));
    requestCount += batch.length;
    pages.push(...batch.map((page) => page.rows));
  }
  return { pages, requestCount };
}
