import { NotFoundError } from "univ-fs";
import { FirebaseFileSystem } from "../FirebaseFileSystem";
import firebaseConfig from "./secret.json";

export const fs = new FirebaseFileSystem("nikochan2k-test", firebaseConfig);

export const setup = async () => {
  try {
    const root = await fs._getDirectory("/");
    await root.rm({ force: true, recursive: true, ignoreHook: true });
    await root.mkdir({ force: true, recursive: false, ignoreHook: true });
  } catch (e) {
    if (e.name !== NotFoundError.name) {
      throw e;
    }
  }
};
