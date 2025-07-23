
import { IpadicFeatures } from "@patdx/kuromoji/build/kuromoji";

// Interfaces matching the structure of kuromoji token data
export interface KuromojiToken extends IpadicFeatures {}

// The final Word structure, mirroring Ve::Word
export interface Word {
  word: string;
  lemma: string;
  part_of_speech: string;
  tokens: KuromojiToken[];
  extra: {
    reading: string;
    transcription: string;
    grammar?: string;
  };
}

// Part of Speech constants from mecab_ipadic.rb, used by the logic
export const MEISHI = "名詞";
export const KOYUUMEISHI = "固有名詞";
export const DAIMEISHI = "代名詞";
export const JODOUSHI = "助動詞";
export const KAZU = "数";
export const JOSHI = "助詞";
export const SETTOUSHI = "接頭詞";
export const DOUSHI = "動詞";
export const KIGOU = "記号";
export const FIRAA = "フィラー";
export const SONOTA = "その他";
export const KANDOUSHI = "感動詞";
export const RENTAISHI = "連体詞";
export const SETSUZOKUSHI = "接続詞";
export const FUKUSHI = "副詞";
export const SETSUZOKUJOSHI = "接続助詞";
export const KEIYOUSHI = "形容詞";
export const HIJIRITSU = "非自立";
export const FUKUSHIKANOU = "副詞可能";
export const SAHENSETSUZOKU = "サ変接続";
export const KEIYOUDOUSHIGOKAN = "形容動詞語幹";
export const NAIKEIYOUSHIGOKAN = "ナイ形容詞語幹";
export const JODOUSHIGOKAN = "助動詞語幹";
export const FUKUSHIKA = "副詞化";
export const TAIGENSETSUZOKU = "体言接続";
export const RENTAIKA = "連体化";
export const TOKUSHU = "特殊";
export const SETSUBI = "接尾";
export const SETSUZOKUSHITEKI = "接続詞的";
export const DOUSHIHIJIRITSUTEKI = "動詞非自立的";
export const SAHEN_SURU = "サ変・スル";
export const TOKUSHU_TA = "特殊・タ";
export const TOKUSHU_NAI = "特殊・ナイ";
export const TOKUSHU_TAI = "特殊・タイ";
export const TOKUSHU_DESU = "特殊・デス";
export const TOKUSHU_DA = "特殊・ダ";
export const TOKUSHU_MASU = "特殊・マス";
export const TOKUSHU_NU = "特殊・ヌ";
export const FUHENKAGATA = "不変化型";
export const JINMEI = "人名";
export const MEIREI_I = "命令ｉ";
export const KAKARIJOSHI = "係助詞";
export const NA = "な";
export const NI = "に";
export const TE = "て";
export const DE = "で";
export const BA = "ば";
export const NN = "ん";
export const SA = "さ";

// Ve PartOfSpeech constants
export const PartOfSpeech = {
  Noun: "noun",
  ProperNoun: "proper_noun",
  Pronoun: "pronoun",
  Verb: "verb",
  Adjective: "adjective",
  Adverb: "adverb",
  Number: "number",
  Suffix: "suffix",
  Prefix: "prefix",
  Conjunction: "conjunction",
  Postposition: "postposition",
  Determiner: "determiner",
  Symbol: "symbol",
  Interjection: "interjection",
  Other: "other",
  TBD: "tbd",
};
