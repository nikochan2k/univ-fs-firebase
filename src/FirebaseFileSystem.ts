import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";
import {
  FirebaseStorage,
  FullMetadata,
  getDownloadURL,
  getMetadata,
  getStorage,
  list,
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
  HeadOptions,
  joinPaths,
  NoModificationAllowedError,
  NotFoundError,
  NotReadableError,
  PatchOptions,
  Props,
  Stats,
  TypeMismatchError,
  URLOptions,
} from "univ-fs";
import { FirebaseDirectory } from "./FirebaseDirectory";
import { FirebaseFile } from "./FirebaseFile";

export interface FirebaseFileSystemOptions extends FirebaseStorage {
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

  public _createMetadata(props: Props) {
    const metadata: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(props)) {
      if (0 <= ["size", "etag", "created", "modified"].indexOf(key)) {
        continue;
      }
      metadata[key] = "" + value; // eslint-disable-line
    }
    return metadata;
  }

  public _error(path: string, e: unknown, write: boolean) {
    let name: string;
    const code: string = (e as any).code; // eslint-disable-line
    if (code === "storage/object-not-found") {
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

  public async _getDirectory(path: string): Promise<AbstractDirectory> {
    return Promise.resolve(new FirebaseDirectory(this, path));
  }

  public async _getEntry(path: string, isDirectory: boolean) {
    const storage = await this._getStorage();
    const key = this._getKey(path, isDirectory);
    return ref(storage, key);
  }

  public async _getFile(path: string): Promise<AbstractFile> {
    return Promise.resolve(new FirebaseFile(this, path));
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
    const key = this._getKey("/", true);
    const root = ref(this.storage, key);
    try {
      await getMetadata(root);
      return this.storage;
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

    return this.storage;
  }

  public async _head(path: string, options?: HeadOptions): Promise<Stats> {
    options = { ...options };
    const isFile = !options.type || options.type === "file";
    const isDirectory = !options.type || options.type === "directory";
    const fileHead = isFile ? this._getMetadata(path, false) : Promise.reject();
    const dirHead = isDirectory
      ? this._getMetadata(path, true)
      : Promise.reject();
    const entry = await this._getEntry(path, isDirectory);
    const dirList = isDirectory
      ? list(entry, { maxResults: 1 })
      : Promise.reject();
    const [fileHeadRes, dirHeadRes, dirListRes] = await Promise.allSettled([
      fileHead,
      dirHead,
      dirList,
    ]);
    if (fileHeadRes.status === "fulfilled") {
      return this._handleHead(fileHeadRes.value, false);
    } else if (dirHeadRes.status === "fulfilled") {
      const stats = this._handleHead(dirHeadRes.value, true);
      delete stats.size;
      return stats;
    } else if (dirListRes.status === "fulfilled") {
      const list = dirListRes.value;
      if (
        (list.items && 0 < list.items.length) ||
        (list.prefixes && 0 < list.prefixes.length)
      ) {
        return {};
      }
    }
    let dirListReason: unknown | undefined;
    if (dirListRes.status === "rejected") {
      dirListReason = dirListRes.reason;
    }
    if (isFile) {
      throw this._error(path, fileHeadRes.reason, false);
    }
    if (isDirectory) {
      if (dirHeadRes.reason) {
        throw this._error(path, dirHeadRes.reason, false);
      }
    }
    throw this._error(path, dirListReason, false);
  }

  public async _patch(
    path: string,
    props: Props,
    _options: PatchOptions // eslint-disable-line
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

  public async _toURL(
    path: string,
    isDirectory: boolean,
    options?: URLOptions
  ): Promise<string> {
    if (isDirectory) {
      throw createError({
        name: TypeMismatchError.name,
        repository: this.repository,
        path,
        e: { message: `"${path}" is not a directory` },
      });
    }

    options = { urlType: "GET", ...options };
    switch (options.urlType) {
      case "GET":
        break;
      default:
        throw this._error(
          path,
          { message: `"${options.urlType}" is not supported` }, // eslint-disable-line
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

  /* eslint-disable */
  private _handleHead(obj: FullMetadata, isDirectory: boolean) {
    const metadata = obj.customMetadata || {};
    const stats: Stats = {};
    for (const [key, value] of Object.entries(metadata)) {
      stats[key] = value;
    }
    if (isDirectory) {
      delete stats.size;
    } else {
      stats.size = obj.size;
    }
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
