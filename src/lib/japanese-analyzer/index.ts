
import { getKuromojiTokenizer } from "./kuromoji-loader";
import { VeProcessor } from "./ve-processor";
import { Word } from "./common";

let veProcessor: VeProcessor | null = null;

async function getVeProcessor(): Promise<VeProcessor> {
  if (veProcessor) {
    return veProcessor;
  }
  // We don't need to await getKuromojiTokenizer here because the processor doesn't depend on it directly.
  // The dependency is on the result of the tokenizer, which is passed to the buildWords method.
  veProcessor = new VeProcessor();
  return veProcessor;
}

export async function analyze(text: string): Promise<Word[]> {
  const tokenizer = await getKuromojiTokenizer();
  const processor = await getVeProcessor();

  const tokens = tokenizer.tokenize(text);
  return processor.buildWords(tokens);
}

export type { Word } from "./common";
