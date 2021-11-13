import { initializeApp } from "@firebase/app";
import { deleteObject, getStorage, ref } from "@firebase/storage";
import { NotFoundError } from "univ-fs";
import { FirebaseFileSystem } from "../FirebaseFileSystem";
import firebaseConfig from "./secret.json";

export const fs = new FirebaseFileSystem("nikochan2k-test", firebaseConfig);

export const setup = async () => {
  try {
    const app = initializeApp(firebaseConfig);
    const storage = getStorage(app);
    const root = ref(storage, "nikochan2k-test");
    await deleteObject(root);
  } catch (e) {
    if (e.name !== NotFoundError.name) {
      throw e;
    }
  }
};

export const teardown = async () => {};
