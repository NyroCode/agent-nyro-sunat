import type { QueryResult } from "@nyro-sunat/core";

export const PUBLIC_SCHEMA_VERSION: "1" = "1";

export interface PublicQueryResult<T> {
  readonly schemaVersion: typeof PUBLIC_SCHEMA_VERSION;
  readonly data: T;
  readonly provenance: QueryResult<T>["provenance"];
  readonly warnings: QueryResult<T>["warnings"];
  readonly requestId: QueryResult<T>["requestId"];
}

export function toPublicQueryResult<T>(result: QueryResult<T>): PublicQueryResult<T> {
  return Object.freeze({
    schemaVersion: PUBLIC_SCHEMA_VERSION,
    data: result.data,
    provenance: result.provenance,
    warnings: Object.freeze([...result.warnings]),
    requestId: result.requestId,
  });
}
