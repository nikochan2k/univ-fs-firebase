import { listAll } from "@firebase/storage";
import { AbstractDirectory, joinPaths } from "univ-fs";
import { FirebaseFileSystem } from "./FirebaseFileSystem";

export class FirebaseDirectory extends AbstractDirectory {
  constructor(private ffs: FirebaseFileSystem, path: string) {
    super(ffs, path);
  }

  public async _list(): Promise<string[]> {
    const ffs = this.ffs;
    const path = this.path;
    const paths: string[] = [];
    try {
      const dir = await ffs._getEntry(path, true);
      const prefix = ffs._getKey(path, true);
      const result = await listAll(dir);
      for (const dir of result.prefixes ?? []) {
        if (prefix === dir.fullPath) {
          continue;
        }
        const parts = dir.fullPath.split("/");
        const name = parts[parts.length - 2] as string;
        const joined = joinPaths(path, name);
        paths.push(joined);
      }
      for (const file of result.items ?? []) {
        if (prefix === file.fullPath) {
          continue;
        }
        const parts = file.fullPath.split("/");
        const name = parts[parts.length - 1] as string;
        const joined = joinPaths(path, name);
        paths.push(joined);
      }
      return paths;
    } catch (e) {
      throw ffs._error(path, e, false);
    }
  }

  public async _mkcol(): Promise<void> {
    return Promise.resolve();
  }

  public async _rmdir(): Promise<void> {
    return Promise.resolve();
  }
}
