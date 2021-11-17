import { initializeApp } from "@firebase/app";
import { getMetadata, getStorage, listAll, ref } from "@firebase/storage";
import { FirebaseFileSystem } from "../FirebaseFileSystem";
import firebaseConfig from "./secret.json";

export const fs = new FirebaseFileSystem("nikochan2k-test", firebaseConfig);

it("list", async () => {
  const app = initializeApp(firebaseConfig);
  const storage = getStorage(app);
  const root = ref(storage, "nikochan2k-test");
  const list = await listAll(root);
  for (const prefix of list.prefixes || []) {
    console.log("prefix", prefix.fullPath);
    console.log(await getMetadata(prefix));
  }
  for (const item of list.items || []) {
    console.log("item", item.fullPath, item);
  }
});
