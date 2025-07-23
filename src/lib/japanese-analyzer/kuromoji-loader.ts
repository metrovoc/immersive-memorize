import * as kuromoji from "@patdx/kuromoji";

let tokenizer: any | null = null;

export async function getKuromojiTokenizer(): Promise<any> {
  if (tokenizer) {
    return tokenizer;
  }

  console.log("[KuromojiLoader] Creating custom loader...");

  const dicPath = chrome.runtime.getURL("dict/kuromoji/");

  // Custom loader to fetch dictionary files from the extension's resources
  const customLoader = {
    async loadArrayBuffer(url: string): Promise<ArrayBuffer> {
      // The 'url' passed by kuromoji is just the filename (e.g., "base.dat.gz")
      // We need to construct the full path to the extension's dictionary file.
      const fullUrl = `${dicPath}${url.replace('.gz', '')}`;
      console.log(`[KuromojiLoader] Loading dictionary file: ${fullUrl}`);
      try {
        const response = await fetch(fullUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${fullUrl}: ${response.statusText}`);
        }
        return await response.arrayBuffer();
      } catch (error) {
        console.error(`[KuromojiLoader] Error fetching dictionary file: ${url}`, error);
        throw error; // Re-throw to stop the process
      }
    },
  };

  console.log("[KuromojiLoader] Starting tokenizer build...");

  try {
    const _tokenizer = await new (kuromoji as any).TokenizerBuilder({
      loader: customLoader,
    }).build();
    
    console.log("[KuromojiLoader] Tokenizer built successfully.");
    tokenizer = _tokenizer;
    return tokenizer;
  } catch (err) {
    console.error("[KuromojiLoader] Failed to build tokenizer:", err);
    throw err;
  }
}