import type { Readable } from 'node:stream';
/** Phase 2 will implement local persistent storage and protected media endpoints. */
export interface StorageProvider {
  save(key: string, content: Readable): Promise<void>;
  open(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
