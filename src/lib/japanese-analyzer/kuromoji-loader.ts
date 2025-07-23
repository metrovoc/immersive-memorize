
import { builder } from "@patdx/kuromoji";

let tokenizer: KuromojiTokenizer | null = null;

export async function getKuromojiTokenizer(): Promise<KuromojiTokenizer> {
  if (tokenizer) {
    return tokenizer;
  }

  const dicPath = chrome.runtime.getURL("dict/kuromoji/");

  return new Promise((resolve, reject) => {
    builder({ dicPath }).build((err: any, _tokenizer: KuromojiTokenizer) => {
      if (err) {
        console.error("Failed to initialize kuromoji tokenizer:", err);
        return reject(err);
      }
      tokenizer = _tokenizer;
      resolve(tokenizer);
    });
  });
}
