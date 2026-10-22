import type { Word } from './common'
import { getTokenizer } from './kuromoji-loader'
import { VeProcessor } from './ve-processor'

const processor = new VeProcessor()

/** Splits Japanese text into words with dictionary forms. Runs in the service worker. */
export async function analyze(text: string): Promise<Word[]> {
  const tokenizer = await getTokenizer()
  return processor.buildWords(tokenizer.tokenize(text))
}

export type { Word } from './common'
