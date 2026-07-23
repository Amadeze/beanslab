declare module "chokidar" {
  import { EventEmitter } from "events";

  interface WatchOptions {
    ignoreInitial?: boolean;
    persistent?: boolean;
    awaitWriteFinish?: boolean | { stabilityThreshold?: number; pollInterval?: number };
    ignored?: string | string[];
    depth?: number;
    cwd?: string;
  }

  class FSWatcher extends EventEmitter {
    close(): void;
    unwatch(paths: string | string[]): void;
  }

  function watch(
    paths: string | string[],
    options?: WatchOptions,
  ): FSWatcher;

  export { watch, FSWatcher, WatchOptions };
}
