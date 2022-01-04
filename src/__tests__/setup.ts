import { initializeApp } from "@firebase/app";
import {
  deleteObject,
  FirebaseStorage,
  getStorage,
  listAll,
  ref,
  StorageReference,
} from "@firebase/storage";
import { FirebaseFileSystem } from "../FirebaseFileSystem";
import firebaseConfig from "./secret.json";

export const fs = new FirebaseFileSystem("nikochan2k-test", firebaseConfig);

const deleteAll = async (dir: StorageReference) => {
  const list = await listAll(dir);
  for (const prefix of list.prefixes || []) {
    await deleteAll(prefix);
  }
  for (const item of list.items || []) {
    await deleteObject(item);
  }
};

export const setup = async () => {
  let storage: FirebaseStorage | undefined;
  try {
    const app = initializeApp(firebaseConfig);
    storage = getStorage(app);
    fs._setupStorage(storage);
    const root = ref(storage);
    await deleteAll(root);
  } catch (e) {
    console.warn(e);
  }
};

export const teardown = async () => {};
