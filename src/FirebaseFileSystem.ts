import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";
import {
  FirebaseStorage,
  FullMetadata,
  getDownloadURL,
  getMetadata,
  getStorage,
  ref,
  updateMetadata,
  uploadString,
} from "firebase/storage";
import {
  AbstractDirectory,
  AbstractFile,
  AbstractFileSystem,
  createError,
  FileSystemOptions,
  joinPaths,
  NoModificationAllowedError,
  NotFoundError,
  NotReadableError,
  Stats,
  TypeMismatchError,
  URLOptions,
} from "univ-fs";
import { FirebaseDirectory } from "./FirebaseDirectory";
import { FirebaseFile } from "./FirebaseFile";

export interface FirebaseFileSystemOptions extends FileSystemOptions {
  bucketUrl?: string;
}

export class FirebaseFileSystem extends AbstractFileSystem {
  private app: FirebaseApp;
  private storage?: FirebaseStorage;

  constructor(
    repository: string,
    firebaseConfig: FirebaseOptions,
    private firebaseOptions?: FirebaseFileSystemOptions
  ) {
    super(repository, firebaseOptions as FileSystemOptions | undefined);
    this.app = initializeApp(firebaseConfig);
  }

  public _createMetadata(props: Stats) {
    const metadata: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(props)) {
      if (!value) continue;
      metadata[key] = "" + value; // eslint-disable-line
    }
    return metadata;
  }

  public _doGetDirectory(path: string): AbstractDirectory {
    return new FirebaseDirectory(this, path);
  }

  public _doGetFile(path: string): AbstractFile {
    return new FirebaseFile(this, path);
  }

  public async _doGetURL(
    path: string,
    isDirectory: boolean,
    options: URLOptions
  ): Promise<string> {
    if (isDirectory) {
      throw createError({
        name: TypeMismatchError.name,
        repository: this.repository,
        path,
        e: { message: `"${path}" is not a directory` },
      });
    }

    options = { method: "GET", ...options };
    switch (options.method) {
      case "GET":
        break;
      default:
        throw this._error(
          path,
          { message: `"${options.method}" is not supported` }, // eslint-disable-line
          false
        );
    }

    const file = await this._getEntry(path, isDirectory);
    try {
      return getDownloadURL(file);
    } catch (e) {
      throw this._error(path, e, false);
    }
  }

  public async _doHead(path: string): Promise<Stats> {
    try {
      const res = await this._getMetadata(path, false);
      return this._handleHead(res);
    } catch (e) {
      throw this._error(path, e, false);
    }
  }

  public async _doPatch(
    path: string,
    _stats: Stats,
    props: Stats
  ): Promise<void> {
    try {
      const obj = await this._getMetadata(path, props["size"] === null);
      obj.customMetadata = this._createMetadata(props);
      const entry = await this._getEntry(path, props["size"] === null);
      await updateMetadata(entry, obj);
    } catch (e) {
      throw this._error(path, e, true);
    }
  }

  public _error(path: string, e: unknown, write: boolean) {
    let name: string;
    const code: string = (e as any).code; // eslint-disable-line
    if (
      !write &&
      (code === "storage/object-not-found" || code === "storage/unauthorized")
    ) {
      name = NotFoundError.name;
    } else if (write) {
      name = NoModificationAllowedError.name;
    } else {
      name = NotReadableError.name;
    }
    return createError({
      name,
      repository: this.repository,
      path,
      e: e as any, // eslint-disable-line
    });
  }

  public async _getEntry(path: string, isDirectory: boolean) {
    const storage = await this._getStorage();
    const key = this._getKey(path, isDirectory);
    return ref(storage, key);
  }

  public _getKey(path: string, isDirectory: boolean) {
    let key: string;
    if (!path || path === "/") {
      key = this.repository;
    } else {
      key = joinPaths(this.repository, path, false);
    }
    if (isDirectory) {
      key += "/";
    }
    return key;
  }

  public async _getMetadata(path: string, isDirectory: boolean) {
    const entry = await this._getEntry(path, isDirectory);
    try {
      return getMetadata(entry);
    } catch (e) {
      throw this._error(path, e, false);
    }
  }

  public async _getStorage() {
    if (this.storage) {
      return this.storage;
    }

    this.storage = getStorage(this.app, this.firebaseOptions?.bucketUrl);
    await this._setupStorage(this.storage);
    return this.storage;
  }

  public async _setupStorage(storage: FirebaseStorage) {
    this.storage = storage;

    const key = this._getKey("/", true);
    const root = ref(storage, key);
    try {
      await getMetadata(root);
    } catch (e) {
      const err = this._error("/", e, false);
      if (err.name !== NotFoundError.name) {
        throw e;
      }
    }
    try {
      await uploadString(root, "");
    } catch (e) {
      throw this._error("/", e, true);
    }
  }

  public canPatchAccessed(): boolean {
    return false;
  }

  public canPatchCreated(): boolean {
    return false;
  }

  public canPatchModified(): boolean {
    return false;
  }

  public supportDirectory(): boolean {
    return false;
  }

  /* eslint-disable */
  private _handleHead(obj: FullMetadata) {
    const metadata = obj.customMetadata || {};
    const stats: Stats = {};
    for (const [key, value] of Object.entries(metadata)) {
      stats[key] = value;
    }
    stats.size = obj.size;
    const created = new Date(obj.timeCreated).getTime();
    if (created) {
      stats.created = created;
    }
    const modified = new Date(obj.updated).getTime();
    if (modified) {
      stats.modified = modified;
    }
    const etag = obj.md5Hash;
    if (etag) {
      stats.etag = etag;
    }

    return stats;
  }

  /* eslint-enable */
}
