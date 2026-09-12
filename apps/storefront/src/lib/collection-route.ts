export function decodeCollectionHandle(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded && !decoded.includes("/") ? decoded : null;
  } catch {
    return null;
  }
}
