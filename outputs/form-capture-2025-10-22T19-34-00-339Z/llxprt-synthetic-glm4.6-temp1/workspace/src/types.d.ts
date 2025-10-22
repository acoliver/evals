declare module 'sql.js' {
  export default function initSqlJs(opts?: { locateFile?: (file: string) => string }): Promise<SqlJsExports>;
  export interface SqlJsExports {
    Database: typeof Database;
  }
  export class Database {
    constructor(data?: ArrayBuffer | Uint8Array);
    run(sql: string, ...params: unknown[]): void;
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }
  export class Statement {
    run(...params: unknown[]): void;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    free(): void;
  }
}