import { TokenizerBuilder } from '@patdx/kuromoji'

type Tokenizer = Awaited<ReturnType<TokenizerBuilder['build']>>

let tokenizer: Promise<Tokenizer> | null = null

/** Builds the tokenizer once from the gzipped dictionaries bundled with the extension. */
export function getTokenizer(): Promise<Tokenizer> {
  tokenizer ??= new TokenizerBuilder({
    loader: {
      async loadArrayBuffer(file: string) {
        const response = await fetch(chrome.runtime.getURL(`dict/kuromoji/${file}`))
        if (!response.ok || !response.body) {
          throw new Error(`Failed to load dictionary file ${file}: ${response.status}`)
        }
        return new Response(
          response.body.pipeThrough(new DecompressionStream('gzip'))
        ).arrayBuffer()
      },
    },
  })
    .build()
    .catch(error => {
      tokenizer = null
      throw error
    })
  return tokenizer
}
