export class Registry<T> {
  private readonly entries = new Map<string, T>();

  add(type: string, value: T): T { this.entries.set(type, value); return value; }
  get(type: string): T | undefined { return this.entries.get(type); }
  values(types?: readonly string[]): T[] {
    return types ? types.flatMap((type) => { const value = this.entries.get(type); return value ? [value] : []; }) : [...this.entries.values()];
  }
}

export type PaletteGroups = Readonly<Record<string, readonly string[]>>;

export type PaletteGroup<T> = { name: string; items: T[] };

export function loadPaletteGroups<T>(groups: PaletteGroups, registry: Registry<T>): PaletteGroup<T>[] {
  return Object.entries(groups).map(([name, types]) => ({ name, items: registry.values(types) }));
}
