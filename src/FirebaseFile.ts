import { deleteObject, uploadBytes } from "@firebase/storage";
import fetch from "isomorphic-fetch";
import { Data, isNode } from "univ-conv";
import {
  AbstractFile,
  createError,
  NotFoundError,
  NotReadableError,
  ReadOptions,
  Stats,
  WriteOptions,
} from "univ-fs";
import { FirebaseFileSystem } from "./FirebaseFileSystem";

export class FirebaseFile extends AbstractFile {
  constructor(private ffs: FirebaseFileSystem, path: string) {
    super(ffs, path);
  }

  // eslint-disable-next-line
  public async _doRead(_stats: Stats, _options: ReadOptions): Promise<Data> {
    const ffs = this.ffs;
    const path = this.path;
    const url = await ffs._doToURL(path, false);
    let response: Response;
    try {
      response = await fetch(url);
    } catch (e: unknown) {
      throw createError({
        name: NotReadableError.name,
        repository: this.ffs.repository,
        path,
        e: e as any, // eslint-disable-line
      });
    }
    if (response.status === 404) {
      throw createError({
        name: NotFoundError.name,
        repository: this.ffs.repository,
        path,
      });
    }
    if (response.status !== 200 || !response.body) {
      throw createError({
        name: NotReadableError.name,
        repository: this.ffs.repository,
        path,
        e: {
          message: `${response.statusText} (${response.status})`, // eslint-disable-line
        },
      });
    }
    return response.body;
  }

  public async _doRm(): Promise<void> {
    const ffs = this.ffs;
    const path = this.path;
    const file = await this.ffs._getEntry(path, false);
    try {
      await deleteObject(file);
    } catch (e) {
      throw ffs._error(path, e, true);
    }
  }

  public async _doWrite(
    data: Data,
    _stats: Stats | undefined,
    options: WriteOptions
  ): Promise<void> {
    const ffs = this.ffs;
    const path = this.path;
    const converter = this._getConverter();

    const file = await this.ffs._getEntry(path, false);
    try {
      if (isNode) {
        const buffer = await converter.toBuffer(data, options);
        await uploadBytes(file, buffer);
      } else {
        const blob = await converter.toBlob(data, options);
        await uploadBytes(file, blob);
      }
    } catch (e) {
      throw ffs._error(path, e, true);
    }
  }

  public supportAppend(): boolean {
    return false;
  }

  public supportRangeRead(): boolean {
    return false;
  }

  public supportRangeWrite(): boolean {
    return false;
  }
}
