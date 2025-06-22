declare module 'conf' {
  interface Options {
    projectName?: string;
    configName?: string;
    cwd?: string;
    schema?: Record<string, any>;
    defaults?: Record<string, any>;
  }

  class Conf {
    constructor(options?: Options);
    get<T>(key: string): T;
    set<T>(key: string, value: T): void;
    set(object: Record<string, any>): void;
    has(key: string): boolean;
    delete(key: string): void;
    clear(): void;
    onDidChange(key: string, callback: (newValue: any, oldValue: any) => void): void;
    size: number;
    store: Record<string, any>;
    path: string;
  }

  export = Conf;
}