/** A bounded cache that keeps recently read layouts, not only recently inserted ones. */
export class LruCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Cache capacity must be positive');
  }

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
  }

  clear(): void {
    this.entries.clear();
  }
}

// Weak references identify immutable collection snapshots without scanning every
// person on cache hits or retaining the database in a separate identity registry.
const referenceIds = new WeakMap<object, number>();
let nextReferenceId = 1;
function referenceId(value: object | undefined): number {
  if (!value) return 0;
  let id = referenceIds.get(value);
  if (id === undefined) {
    id = nextReferenceId++;
    referenceIds.set(value, id);
  }
  return id;
}

/** Replace a collection when editing it, or update a revision/clear the cache after an in-place edit. */
export type LayoutDataRevision = [number, number, unknown, unknown, unknown];
export function getLayoutDataRevision(database: {
  persons?: object; families?: object; lastModified?: unknown; version?: unknown;
  metadata?: { lastModified?: unknown };
}): LayoutDataRevision {
  return [
    referenceId(database.persons),
    referenceId(database.families),
    database.lastModified ?? null,
    database.version ?? null,
    database.metadata?.lastModified ?? null
  ];
}
