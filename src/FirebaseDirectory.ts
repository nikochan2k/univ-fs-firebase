import { deleteObject, listAll, uploadString } from "@firebase/storage";
import { AbstractDirectory, joinPaths } from "univ-fs";
import { FirebaseFileSystem } from "./FirebaseFileSystem";

export class FirebaseDirectory extends AbstractDirectory {
  constructor(private gfs: FirebaseFileSystem, path: string) {
    super(gfs, path);
  }

  public async _list(): Promise<string[]> {
    const gfs = this.gfs;
    const path = this.path;
    const paths: string[] = [];
    try {
      const dir = await gfs._getEntry(path, true);
      const prefix = gfs._getKey(path, true);
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
      throw gfs._error(path, e, false);
    }
  }

  public async _mkcol(): Promise<void> {
    const gfs = this.gfs;
    const path = this.path;
    try {
      const dir = await gfs._getEntry(path, true);
      await uploadString(dir, "");
    } catch (e) {
      throw gfs._error(path, e, true);
    }
  }

  public async _rmdir(): Promise<void> {
    const gfs = this.gfs;
    const path = this.path;
    try {
      const dir = await gfs._getEntry(path, true);
      await deleteObject(dir);
    } catch (e) {
      throw gfs._error(path, e, true);
    }
  }
}
