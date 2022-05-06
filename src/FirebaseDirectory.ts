import { listAll } from "@firebase/storage";
import { AbstractDirectory, Item, joinPaths } from "univ-fs";
import { FirebaseFileSystem } from "./FirebaseFileSystem";

export class FirebaseDirectory extends AbstractDirectory {
  constructor(private ffs: FirebaseFileSystem, path: string) {
    super(ffs, path);
  }

  public async _doList(): Promise<Item[]> {
    const ffs = this.ffs;
    const path = this.path;
    const items: Item[] = [];
    try {
      const dir = await ffs._getEntry(path, true);
      const prefix = ffs._getKey(path, true);
      const result = await listAll(dir);
      for (const file of result.items ?? []) {
        if (prefix === file.fullPath) {
          continue;
        }
        const parts = file.fullPath.split("/");
        const name = parts[parts.length - 1] as string;
        const joined = joinPaths(path, name);
        items.push({ path: joined }); // eslint-disable-line
      }
      return items; // eslint-disable-line @typescript-eslint/no-unsafe-return
    } catch (e) {
      throw ffs._error(path, e, false);
    }
  }

  public async _doMkcol(): Promise<void> {
    return Promise.resolve();
  }

  public async _doRmdir(): Promise<void> {
    return Promise.resolve();
  }
}
