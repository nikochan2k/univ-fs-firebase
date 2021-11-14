import { deleteObject, updateMetadata, uploadBytes } from "@firebase/storage";
import * as http from "http";
import * as https from "https";
import { Converter, Data, isNode } from "univ-conv";
import {
  AbstractFile,
  createError,
  NotFoundError,
  NotReadableError,
  OpenOptions,
  Stats,
  WriteOptions,
} from "univ-fs";
import { FirebaseFileSystem } from "./FirebaseFileSystem";

export class FirebaseFile extends AbstractFile {
  constructor(private ffs: FirebaseFileSystem, path: string) {
    super(ffs, path);
  }

  // eslint-disable-next-line
  protected async _load(_stats: Stats, _options: OpenOptions): Promise<Data> {
    const ffs = this.ffs;
    const path = this.path;
    const url = await ffs._toURL(path, false);
    if (isNode) {
      const proto = url.startsWith("https://") ? https : http;
      return new Promise((resolve, reject) => {
        proto.get(url, (response) => {
          if (response.statusCode === 404) {
            reject(
              createError({
                name: NotFoundError.name,
                repository: this.ffs.repository,
                path,
              })
            );
            return;
          }
          if (response.statusCode !== 200) {
            reject(
              createError({
                name: NotReadableError.name,
                repository: this.ffs.repository,
                path,
                e: {
                  message: `${response.statusMessage} (${response.statusCode})`, // eslint-disable-line
                },
              })
            );
            return;
          }

          resolve(response);
        });
      });
    } else {
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
  }

  protected async _rm(): Promise<void> {
    const ffs = this.ffs;
    const path = this.path;
    const file = await this.ffs._getEntry(path, false);
    try {
      await deleteObject(file);
    } catch (e) {
      throw ffs._error(path, e, true);
    }
  }

  protected async _save(
    data: Data,
    stats: Stats | undefined,
    options: WriteOptions
  ): Promise<void> {
    const ffs = this.ffs;
    const path = this.path;
    const converter = new Converter(options);

    let head: Data | undefined;
    if (options.append && stats) {
      head = await this._load(stats, options);
    }

    const file = await this.ffs._getEntry(path, false);
    if (stats) {
      const obj = await this.ffs._getMetadata(path, false);
      obj.customMetadata = ffs._createMetadata(stats); // eslint-disable-line
      await updateMetadata(file, obj);
    }

    try {
      if (isNode) {
        let u8: Uint8Array;
        if (head) {
          u8 = await converter.merge([head, data], "Uint8Array");
        } else {
          u8 = await converter.toUint8Array(data);
        }
        await uploadBytes(file, u8);
      } else {
        let blob: Blob;
        if (head) {
          blob = await converter.merge([head, data], "Blob");
        } else {
          blob = await converter.toBlob(data);
        }
        await uploadBytes(file, blob);
      }
    } catch (e) {
      throw ffs._error(path, e, true);
    }
  }
}
