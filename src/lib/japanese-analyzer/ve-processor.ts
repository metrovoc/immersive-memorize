
import {
  Word,
  KuromojiToken,
  MEISHI,
  KOYUUMEISHI,
  DAIMEISHI,
  JODOUSHI,
  KAZU,
  JOSHI,
  SETTOUSHI,
  DOUSHI,
  KIGOU,
  FIRAA,
  SONOTA,
  KANDOUSHI,
  RENTAISHI,
  SETSUZOKUSHI,
  FUKUSHI,
  SETSUZOKUJOSHI,
  KEIYOUSHI,
  HIJIRITSU,
  FUKUSHIKANOU,
  SAHENSETSUZOKU,
  KEIYOUDOUSHIGOKAN,
  NAIKEIYOUSHIGOKAN,
  JODOUSHIGOKAN,
  FUKUSHIKA,
  TAIGENSETSUZOKU,
  RENTAIKA,
  TOKUSHU,
  SETSUBI,
  SETSUZOKUSHITEKI,
  DOUSHIHIJIRITSUTEKI,
  SAHEN_SURU,
  TOKUSHU_TA,
  TOKUSHU_NAI,
  TOKUSHU_TAI,
  TOKUSHU_DESU,
  TOKUSHU_DA,
  TOKUSHU_MASU,
  TOKUSHU_NU,
  FUHENKAGATA,
  JINMEI,
  MEIREI_I,
  KAKARIJOSHI,
  NA,
  NI,
  TE,
  DE,
  BA,
  NN,
  SA,
  PartOfSpeech,
} from "./common";

export class VeProcessor {
  public buildWords(tokens: KuromojiToken[]): Word[] {
    const words: Word[] = [];
    let i = 0;

    while (i < tokens.length) {
      const currentToken = tokens[i];
      const previousToken = i > 0 ? tokens[i - 1] : null;
      const followingToken = i + 1 < tokens.length ? tokens[i + 1] : null;

      let pos: string | null = null;
      let grammar: string | undefined = undefined;
      let eat_next = false;
      let eat_lemma = true;
      let attach_to_previous = false;
      let also_attach_to_lemma = false;
      let update_pos = false;

      switch (currentToken.pos) {
        case MEISHI:
          pos = PartOfSpeech.Noun;
          switch (currentToken.pos_detail_1) {
            case KOYUUMEISHI:
              pos = PartOfSpeech.ProperNoun;
              break;
            case DAIMEISHI:
              pos = PartOfSpeech.Pronoun;
              break;
            case FUKUSHIKANOU:
            case SAHENSETSUZOKU:
            case KEIYOUDOUSHIGOKAN:
            case NAIKEIYOUSHIGOKAN:
              if (followingToken) {
                if (followingToken.conjugated_type === SAHEN_SURU) {
                  pos = PartOfSpeech.Verb;
                  eat_next = true;
                } else if (followingToken.conjugated_type === TOKUSHU_DA) {
                  pos = PartOfSpeech.Adjective;
                  if (followingToken.conjugated_form === TAIGENSETSUZOKU) {
                    eat_next = true;
                    eat_lemma = true; // Correctly append lemma
                  }
                } else if (followingToken.conjugated_type === TOKUSHU_NAI) {
                  pos = PartOfSpeech.Adjective;
                  eat_next = true;
                } else if (
                  followingToken.pos === JOSHI &&
                  followingToken.surface_form === NI
                ) {
                  pos = PartOfSpeech.Adverb;
                }
              }
              break;
            case HIJIRITSU:
            case TOKUSHU:
              if (followingToken && currentToken.pos_detail_2) {
                switch (currentToken.pos_detail_2) {
                  case FUKUSHIKANOU:
                    if (
                      followingToken.pos === JOSHI &&
                      followingToken.surface_form === NI
                    ) {
                      pos = PartOfSpeech.Adverb;
                      eat_next = true;
                      eat_lemma = false;
                    }
                    break;
                  case JODOUSHIGOKAN:
                    if (followingToken.conjugated_type === TOKUSHU_DA) {
                      pos = PartOfSpeech.Verb;
                      grammar = "auxiliary";
                      if (followingToken.conjugated_form === TAIGENSETSUZOKU) {
                        eat_next = true;
                      }
                    } else if (
                      followingToken.pos === JOSHI &&
                      followingToken.pos_detail_1 === FUKUSHIKA
                    ) {
                      pos = PartOfSpeech.Adverb;
                      eat_next = true;
                      eat_lemma = false;
                    }
                    break;
                  case KEIYOUDOUSHIGOKAN:
                    pos = PartOfSpeech.Adjective;
                    if (
                      (followingToken.conjugated_type === TOKUSHU_DA &&
                        followingToken.conjugated_form === TAIGENSETSUZOKU) ||
                      followingToken.pos_detail_1 === RENTAIKA
                    ) {
                      eat_next = true;
                    }
                    break;
                }
              }
              break;
            case KAZU:
              pos = PartOfSpeech.Number;
              if (
                words.length > 0 &&
                words[words.length - 1].part_of_speech === PartOfSpeech.Number
              ) {
                attach_to_previous = true;
                also_attach_to_lemma = true;
              }
              break;
            case SETSUBI:
              if (currentToken.pos_detail_2 === JINMEI) {
                pos = PartOfSpeech.Suffix;
              } else {
                if (
                  currentToken.pos_detail_2 === TOKUSHU &&
                  currentToken.basic_form === SA
                ) {
                  update_pos = true;
                  pos = PartOfSpeech.Noun;
                } else {
                  also_attach_to_lemma = true;
                }
                attach_to_previous = true;
              }
              break;
            case SETSUZOKUSHITEKI:
              pos = PartOfSpeech.Conjunction;
              break;
            case DOUSHIHIJIRITSUTEKI:
              pos = PartOfSpeech.Verb;
              grammar = "nominal";
              break;
          }
          break;
        case SETTOUSHI:
          pos = PartOfSpeech.Prefix;
          break;
        case JODOUSHI:
          pos = PartOfSpeech.Postposition;
          const lastWord = words.length > 0 ? words[words.length - 1] : null;
          const lastToken = lastWord
            ? lastWord.tokens[lastWord.tokens.length - 1]
            : null;

          if (
            (!lastToken || lastToken.pos_detail_1 !== KAKARIJOSHI) &&
            [
              TOKUSHU_TA,
              TOKUSHU_NAI,
              TOKUSHU_TAI,
              TOKUSHU_MASU,
              TOKUSHU_NU,
            ].includes(currentToken.conjugated_type)
          ) {
            attach_to_previous = true;
          } else if (
            currentToken.conjugated_type === FUHENKAGATA &&
            currentToken.basic_form === NN
          ) {
            attach_to_previous = true;
          } else if (
            (currentToken.conjugated_type === TOKUSHU_DA ||
              currentToken.conjugated_type === TOKUSHU_DESU) &&
            currentToken.surface_form !== NA
          ) {
            pos = PartOfSpeech.Verb;
          }
          break;
        case DOUSHI:
          pos = PartOfSpeech.Verb;
          if (
            currentToken.pos_detail_1 === SETSUBI ||
            (currentToken.pos_detail_1 === HIJIRITSU &&
              currentToken.conjugated_form !== MEIREI_I)
          ) {
            attach_to_previous = true;
          }
          break;
        case KEIYOUSHI:
          pos = PartOfSpeech.Adjective;
          break;
        case JOSHI:
          pos = PartOfSpeech.Postposition;
          if (
            currentToken.pos_detail_1 === SETSUZOKUJOSHI &&
            [TE, DE, BA].includes(currentToken.surface_form)
          ) {
            attach_to_previous = true;
          }
          break;
        case RENTAISHI:
          pos = PartOfSpeech.Determiner;
          break;
        case SETSUZOKUSHI:
          pos = PartOfSpeech.Conjunction;
          break;
        case FUKUSHI:
          pos = PartOfSpeech.Adverb;
          break;
        case KIGOU:
          pos = PartOfSpeech.Symbol;
          break;
        case FIRAA:
        case KANDOUSHI:
          pos = PartOfSpeech.Interjection;
          break;
        case SONOTA:
          pos = PartOfSpeech.Other;
          break;
      }

      if (attach_to_previous && words.length > 0) {
        const lastWord = words[words.length - 1];
        lastWord.tokens.push(currentToken);
        lastWord.word += currentToken.surface_form;
        lastWord.extra.reading += currentToken.reading || "";
        lastWord.extra.transcription += currentToken.pronunciation || "";
        if (also_attach_to_lemma) {
          lastWord.lemma += currentToken.basic_form;
        }
        if (update_pos && pos) {
          lastWord.part_of_speech = pos;
        }
      } else {
        const newWord: Word = {
          word: currentToken.surface_form,
          lemma: currentToken.basic_form,
          part_of_speech: pos || PartOfSpeech.TBD,
          tokens: [currentToken],
          extra: {
            reading: currentToken.reading || "",
            transcription: currentToken.pronunciation || "",
            ...(grammar && { grammar }),
          },
        };

        if (eat_next && followingToken) {
          newWord.tokens.push(followingToken);
          newWord.word += followingToken.surface_form;
          newWord.extra.reading += followingToken.reading || "";
          newWord.extra.transcription += followingToken.pronunciation || "";
          if (eat_lemma) {
            newWord.lemma += followingToken.basic_form;
          }
          i++; // Increment to skip the next token
        }
        words.push(newWord);
      }
      i++; // Move to the next token
    }
    return words;
  }
}
