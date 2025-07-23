
import { analyze, Word } from '@/lib/japanese-analyzer';
import { VocabLibraryManager } from '@/lib/vocab-library';

export class SubtitleProcessor {
  private vocabLibraryManager: VocabLibraryManager;
  private learnedWords: Set<string>;
  private activeWordLemmas: Set<string>;
  private debugMode: boolean;

  constructor(vocabLibraryManager: VocabLibraryManager, learnedWords: Set<string>, debugMode: boolean = true) {
    this.vocabLibraryManager = vocabLibraryManager;
    this.learnedWords = learnedWords;
    this.debugMode = debugMode;
    this.activeWordLemmas = new Set(); // Initialize explicitly
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
    // The text content of the container might be split across multiple elements (e.g., with <br> or ruby tags)
    // innerText gives a reasonable representation of what the user sees.
    const text = container.innerText;
    if (!text || text.trim() === '') return null;

    try {
      const analyzedWords = await analyze(text);
      if (this.debugMode) {
        console.log('[SubtitleProcessor] Analyzed words:', analyzedWords.map(w => w.word).join(' | '));
      }

      const targetWord = this.findFirstTargetWord(analyzedWords);

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

  private findFirstTargetWord(analyzedWords: Word[]): Word | null {
    for (const word of analyzedWords) {
      const lemma = word.lemma;

      // A word is a target if:
      // 1. It's a learnable part of speech.
      // 2. Its lemma is in our active vocabulary list.
      // 3. Its lemma has not been learned yet.
      if (this.isLearnable(word) && this.activeWordLemmas.has(lemma) && !this.learnedWords.has(lemma)) {
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
