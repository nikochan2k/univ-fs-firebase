import { Storage } from "@google-cloud/storage";
// import { converter } from "univ-conv";

/*
it("Get", async () => {
  const storage = new Storage({
    keyFilename: "secret.json",
  });
  const bucket = storage.bucket("nikochan2k-test");
  const file = bucket.file("text.txt", {});
  const ws = file.createWriteStream();
  await converter.pipe("test", ws);
  const metadata = await file.getMetadata();
});
*/

it("List", async () => {
  const storage = new Storage({
    keyFilename: "secret.json",
  });
  const bucket = storage.bucket("nikochan2k-test");
  const files1 = await bucket.getFiles({ prefix: "", delimiter: "/" });
  console.log(files1[0]);
  const files2 = await bucket.getFiles({ prefix: "hoge/", delimiter: "/" });
  console.log(files2[0]);
});

/*
it("Nothing", async () => {
  const storage = new Storage({
    keyFilename: "secret.json",
  });
  const bucket = storage.bucket("nikochan2k-test");
  const file = bucket.file("hoge.txt", {});
  try {
    const metadata = await file.getMetadata();
    console.log(metadata[0]);
  } catch (e) {
    console.log(e);
  }
});
*/
