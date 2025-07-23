
import { getTokenizer, KuromojiTokenizer } from "@patdx/kuromoji";

let tokenizer: KuromojiTokenizer | null = null;

export async function getKuromojiTokenizer(): Promise<KuromojiTokenizer> {
  if (tokenizer) {
    return tokenizer;
  }

  const dicPath = chrome.runtime.getURL("dict/kuromoji");

  try {
    tokenizer = await getTokenizer({
      dicPath: dicPath,
    });
    return tokenizer;
  } catch (err) {
    console.error("Failed to initialize kuromoji tokenizer:", err);
    throw err;
  }
}
