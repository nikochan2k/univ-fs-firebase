import { OnExists, OnNoParent, OnNotExist } from "univ-fs";
import { FirebaseFileSystem } from "../FirebaseFileSystem";
import firebaseConfig from "./secret.json";

export const fs = new FirebaseFileSystem("nikochan2k-test", firebaseConfig);

export const setup = async () => {
  const root = await fs.getDirectory("/");
  await root.rm({
    onNotExist: OnNotExist.Ignore,
    recursive: true,
    ignoreHook: true,
  });
  await root.mkdir({
    onExists: OnExists.Ignore,
    onNoParent: OnNoParent.Error,
    ignoreHook: true,
  });
};
