// Global interfaces for Kuromoji since module resolution is tricky.
interface KuromojiToken {
    word_id: number;
    word_type: 'KNOWN' | 'UNKNOWN';
    word_position: number;
    surface_form: string;
    pos: string;
    pos_detail_1: string;
    pos_detail_2: string;
    pos_detail_3: string;
    conjugated_type: string;
    conjugated_form: string;
    basic_form: string;
    reading?: string;
    pronunciation?: string;
}

interface KuromojiTokenizer {
    tokenize(text: string): KuromojiToken[];
}

// Declare the module for the builder function itself.
declare module '@patdx/kuromoji' {
    export function builder(options: { dicPath: string }): {
        build(callback: (err: any, tokenizer: KuromojiTokenizer) => void): void;
    };
}
