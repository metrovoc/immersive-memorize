
import { analyze, Word } from '@/lib/japanese-analyzer/remote-analyzer';
import { CachedRemoteVocabLibraryManager } from '@/lib/vocab-library/cached-remote-vocab-library';
import { SubtitleTextParser, type FuriganaMapping, type ParsedSubtitleText } from './subtitle-text-parser';
import type { VocabEntry } from '@/types';

export class SubtitleProcessor {
  private vocabLibraryManager: CachedRemoteVocabLibraryManager;
  private learnedWords: Set<string>;
  private activeWordLemmas: Set<string>;
  private debugMode: boolean;
  private textParser: SubtitleTextParser;

  constructor(vocabLibraryManager: CachedRemoteVocabLibraryManager, learnedWords: Set<string>, debugMode: boolean = true) {
    this.vocabLibraryManager = vocabLibraryManager;
    this.learnedWords = learnedWords;
    this.debugMode = debugMode;
    this.activeWordLemmas = new Set(); // Initialize explicitly
    this.textParser = new SubtitleTextParser();
    this.updateWordLists(); // Then call the method that sets it
  }

  public async updateWordLists(): Promise<void> {
    // Get the list of active, unlearned words (lemmas) from the library
    const activeList = await this.vocabLibraryManager.getActiveWordlist();
    this.activeWordLemmas = new Set(activeList);
    if (this.debugMode) {
      console.log(`[SubtitleProcessor] Word lists updated. ${this.activeWordLemmas.size} active lemmas to look for.`);
    }
  }

  public setLearnedWords(learnedWords: Set<string>): void {
    this.learnedWords = learnedWords;
  }

  public async processAndHighlight(container: HTMLElement): Promise<Word | null> {
    try {
      // 使用新的解析器处理字幕，提取纯文本和Furigana映射
      const parsedText = this.textParser.parse(container);
      
      if (!parsedText.cleanText || parsedText.cleanText.trim() === '') {
        return null;
      }

      if (this.debugMode) {
        console.log('[SubtitleProcessor] Parsed text:', parsedText.cleanText);
        console.log('[SubtitleProcessor] Furigana mappings:', parsedText.furiganaMap);
      }

      // 使用纯文本进行日语分析
      const analyzedWords = await analyze(parsedText.cleanText);
      if (this.debugMode) {
        console.log('[SubtitleProcessor] Analyzed words:', analyzedWords.map(w => w.word).join(' | '));
      }

      // 寻找目标词汇，包含双重验证
      const targetWord = this.findFirstTargetWord(analyzedWords, parsedText.furiganaMap);

      if (targetWord) {
        this.highlightWord(container, targetWord);
        return targetWord;
      }

      return null;
    } catch (error) {
      console.error('[Immersive Memorize] Error processing subtitles:', error);
      return null;
    }
  }

  private findFirstTargetWord(analyzedWords: Word[], furiganaMap: FuriganaMapping[]): Word | null {
    for (const word of analyzedWords) {
      const lemma = word.lemma;

      // A word is a target if:
      // 1. It's a learnable part of speech.
      // 2. Its lemma is in our active vocabulary list.
      // 3. Its lemma has not been learned yet.
      // 4. 通过双重验证（如果有Furigana的话）
      if (this.isLearnable(word) && 
          this.activeWordLemmas.has(lemma) && 
          !this.learnedWords.has(lemma) &&
          this.validateWordWithFurigana(word, furiganaMap)) {
        
        if (this.debugMode) {
          console.log(`[SubtitleProcessor] Found target word: ${word.word} (lemma: ${lemma})`);
        }
        return word;
      }
    }
    return null;
  }

  private isLearnable(word: Word): boolean {
    const nonLearnablePos = [
        'postposition', // 助詞 (Joshi)
        'symbol',       // 記号 (Kigou)
        'interjection', // 感動詞 (Kandoushi)
        'prefix',       // 接頭詞 (Settoushi) - often not standalone words
        'other',        // その他
        'auxiliary_verb'// 助動詞 (Jodoushi) - handled by attachment logic in ve-processor
    ];
    // Also filter out words that are just punctuation or single characters that are not kanji/kana
    if (word.part_of_speech === 'TBD' || nonLearnablePos.includes(word.part_of_speech)) {
        return false;
    }
    // Filter out standalone particles or symbols that might slip through
    if (word.tokens.length === 1 && /^[\p{P}\p{S}]$/u.test(word.word)) {
        return false;
    }
    return true;
  }

  /**
   * 验证词汇与Furigana的一致性
   * 实现双重验证机制，防止专有名词误识别
   */
  private validateWordWithFurigana(word: Word, furiganaMap: FuriganaMapping[]): boolean {
    // 查找该词汇对应的Furigana
    const mapping = this.textParser.findFuriganaForWord(word, furiganaMap);
    
    if (!mapping) {
      // 无Furigana时，按原逻辑处理（可能是平假名词汇或无Ruby标记）
      return true;
    }

    // 从词典获取标准读音
    const vocabEntry = this.findVocabEntry(word.lemma);
    if (!vocabEntry || !vocabEntry.VocabFurigana) {
      // 词典中找不到或无读音信息，可能是专有名词，拒绝学习
      if (this.debugMode) {
        console.log(`[SubtitleProcessor] Rejecting word ${word.word}: not found in vocab or no reading`);
      }
      return false;
    }

    // 比较Furigana与词典读音
    const isMatched = this.isReadingMatched(mapping.furigana, vocabEntry.VocabFurigana);
    
    if (this.debugMode) {
      console.log(`[SubtitleProcessor] Reading validation for ${word.word}:`);
      console.log(`  Context Furigana: ${mapping.furigana}`);
      console.log(`  Dictionary reading: ${vocabEntry.VocabFurigana}`);
      console.log(`  Match result: ${isMatched}`);
    }

    return isMatched;
  }

  /**
   * 从词汇库中查找词汇条目
   */
  private findVocabEntry(lemma: string): VocabEntry | null {
    const selectedLibrary = this.vocabLibraryManager.getSelectedLibrary();
    if (!selectedLibrary) return null;

    return selectedLibrary.data.find(entry => entry.VocabKanji === lemma) || null;
  }

  /**
   * 比较两个读音是否匹配
   * 处理平假名/片假名转换、长音符等差异
   */
  private isReadingMatched(contextReading: string, dictReading: string): boolean {
    const normalize = (reading: string): string => {
      return reading
        .replace(/ー/g, '') // 移除长音符
        .replace(/ッ/g, 'つ') // 统一促音
        .replace(/[ァ-ヴ]/g, (match) => { // 片假名转平假名
          return String.fromCharCode(match.charCodeAt(0) - 0x60);
        })
        .normalize('NFC')
        .toLowerCase();
    };

    const normalizedContext = normalize(contextReading);
    const normalizedDict = normalize(dictReading);

    // 精确匹配
    if (normalizedContext === normalizedDict) {
      return true;
    }

    // 部分匹配（处理词汇变形）
    if (normalizedContext.includes(normalizedDict) || normalizedDict.includes(normalizedContext)) {
      return true;
    }

    // 计算相似度（可选的容错机制）
    const similarity = this.calculateReadingSimilarity(normalizedContext, normalizedDict);
    return similarity > 0.8; // 80%相似度阈值
  }

  /**
   * 计算读音相似度
   */
  private calculateReadingSimilarity(reading1: string, reading2: string): number {
    const len1 = reading1.length;
    const len2 = reading2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    // 简单的编辑距离算法
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = reading1[i - 1] === reading2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // 删除
          matrix[i][j - 1] + 1,      // 插入
          matrix[i - 1][j - 1] + cost // 替换
        );
      }
    }
    
    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len1][len2]) / maxLen;
  }

  private highlightWord(container: HTMLElement, wordToHighlight: Word): void {
    // Security check: If there is already a highlight, do not process again
    if (container.querySelector('.im-highlight')) {
      if (this.debugMode) {
        console.log('[SubtitleProcessor] Highlight already exists, skipping.');
      }
      return;
    }
    
    const surfaceForm = wordToHighlight.word;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    const nodesToProcess: Text[] = [];

    // First, collect all text nodes
    while(node = walker.nextNode()) {
        nodesToProcess.push(node as Text);
    }

    // Process nodes in reverse to avoid issues with node splitting
    for (const textNode of nodesToProcess.reverse()) {
        let text = textNode.textContent || '';
        let wordIndex = text.lastIndexOf(surfaceForm);

        // Find the last occurrence in this node, as we are iterating backwards
        if (wordIndex !== -1) {
            const parent = textNode.parentNode;
            if (!parent) continue;

            // Split the node to isolate the word
            const afterText = text.substring(wordIndex + surfaceForm.length);
            const highlightText = text.substring(wordIndex, wordIndex + surfaceForm.length);
            const beforeText = text.substring(0, wordIndex);

            // Create the highlight span
            const highlightSpan = document.createElement('span');
            highlightSpan.className = 'im-highlight im-current-target';
            highlightSpan.textContent = highlightText;
            highlightSpan.style.cssText = `
              background-color: #ff9800 !important;
              color: #000 !important;
              padding: 2px 4px !important;
              border-radius: 4px !important;
              font-weight: bold !important;
              border: 2px solid #f57c00 !important;
              box-shadow: 0 0 8px rgba(255, 152, 0, 0.6) !important;
              animation: pulse 2s infinite !important;
            `;

            // Re-assemble the nodes
            if (afterText) {
                parent.insertBefore(document.createTextNode(afterText), textNode.nextSibling);
            }
            parent.insertBefore(highlightSpan, textNode.nextSibling);
            if (beforeText) {
                parent.insertBefore(document.createTextNode(beforeText), highlightSpan);
            }

            parent.removeChild(textNode);
            // Since we found and highlighted the word, we can stop.
            // This ensures only the first unlearned word in the subtitle block is highlighted.
            return;
        }
    }
  }
}
