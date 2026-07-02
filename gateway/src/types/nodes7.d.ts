/** Minimal typings for nodes7 (no published @types package). */
declare module 'nodes7' {
  interface ConnectionParams {
    host: string;
    port?: number;
    rack?: number;
    slot?: number;
    timeout?: number;
    localTSAP?: number;
    remoteTSAP?: number;
  }

  export default class NodeS7 {
    constructor(opts?: { silent?: boolean; debug?: boolean });
    initiateConnection(params: ConnectionParams, callback: (err?: Error) => void): void;
    dropConnection(callback?: () => void): void;
    addItems(items: string | string[]): void;
    removeItems(items?: string | string[]): void;
    readAllItems(callback: (anythingBad: boolean, values: Record<string, unknown>) => void): void;
    writeItems(
      items: string | string[],
      values: unknown,
      callback: (anythingBad: boolean) => void,
    ): number;
  }
}
