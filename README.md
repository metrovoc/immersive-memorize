# Immersive Memorize

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/hckblmpcigelkfeinckgflolbdbmdnai?label=Chrome%20Web%20Store)](https://chromewebstore.google.com/detail/immersive-memorize/hckblmpcigelkfeinckgflolbdbmdnai)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Learn Japanese vocabulary while you watch. Immersive Memorize highlights one new JLPT word at a time in Netflix subtitles or in your own subtitle files. Press a key to save it as a flashcard with its sentence, reading, definition and an optional screenshot, then export your cards to Anki.

[中文说明](README.zh-CN.md)

## Features

- **One word at a time.** The first word in each subtitle line that belongs to your chosen JLPT levels (N5–N1) and that you haven't saved yet is highlighted. Save it and the next one lights up.
- **Netflix and any other video.** Netflix subtitles work as they are. On other sites, load an SRT, VTT, ASS or SSA file; UTF-8, UTF-16 and Shift_JIS files are all read correctly.
- **Cards with context.** Each card keeps the sentence with its furigana, the reading, an English or Chinese definition, the timestamp, the show and episode, and optionally a screenshot of the video frame.
- **Anki-ready export.** The CSV export writes Anki's file headers, converts furigana to Anki's `漢字[かんじ]` format, bolds the saved word and embeds screenshots. Plain-text and HTML formats are available too.
- **Vocabulary browser.** Follow your progress through about 14,600 JLPT words with readings, definitions, parts of speech and pitch accents.
- **Private.** Cards and screenshots stay in your browser. Settings sync through your Chrome profile, and you can back your cards up to a file.
- **English and Chinese interface**, following your browser's language.

## Install

Install [Immersive Memorize from the Chrome Web Store](https://chromewebstore.google.com/detail/immersive-memorize/hckblmpcigelkfeinckgflolbdbmdnai).

To run a build from source instead, see [Development](#development) and load the `dist` folder from `chrome://extensions` with Developer mode turned on.

## Usage

### On Netflix

1. Play a Japanese title with Japanese subtitles turned on.
2. The first new word in each subtitle is highlighted in orange.
3. Press **S** (you can change the key in Settings) to save it. The next word is highlighted.

### On other sites

1. Open the page with the video, click the Immersive Memorize toolbar icon and open the **Subtitles** tab.
2. Click **Load subtitle file**, pick the video if the page has several, and choose your file. Japanese subtitles are available from sites such as [Kitsunekko](https://kitsunekko.net/) and [learnjapanese.moe](https://learnjapanese.moe/kitsubackup.html#/ja).
3. Adjust the size, position, background and timing in the popup if needed, then learn words the same way as on Netflix.

The extension starts automatically on Netflix. Elsewhere it starts when you click its icon, or automatically on sites you add in Settings.

### Exporting to Anki

1. Open **Options → Flashcards** and click **Export CSV**.
2. In Anki, choose **File → Import** and select the file. With the default Anki format, Anki reads the separator, HTML setting and field names from the file; map the fields to your note type and import.

## Permissions

| Permission                    | Why it is needed                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access to netflix.com         | Run on Netflix automatically.                                                                                                                                                    |
| `activeTab`, `scripting`      | Start on the current tab when you click the icon.                                                                                                                                |
| `tabs`                        | Recognize the sites where it should start automatically and update the icon.                                                                                                     |
| `storage`, `unlimitedStorage` | Keep settings, cards and screenshots.                                                                                                                                            |
| Other sites (optional)        | Requested only when needed: for the sites you add to start automatically, for every site if you turn that on, for screenshots, and for video players embedded from another site. |

## Development

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev      # rebuild dist/ whenever a file changes
npm run build    # production build in dist/
npm run check    # type-check, lint, format check and tests
npm run package  # build and zip dist/ for the Chrome Web Store
```

After rebuilding, click the reload button of the extension on `chrome://extensions`.

The code is organized by extension context:

- `src/background.ts` and `src/background/`: the service worker. It runs the Japanese analyzer (kuromoji), serves the word list, stores cards and starts the content script on tabs.
- `src/content-script/`: runs in web pages. It reads Netflix or custom subtitles, highlights words and saves cards.
- `src/popup/` and `src/options/`: the extension's popup and options page.
- `src/lib/`: code shared between them, such as settings, storage, subtitle parsing and CSV export.
- `_locales/`: interface text. English (`en`) is the default; every other locale has the same keys, which the tests check.

To release, run `npm version minor` (or `patch`). It updates `manifest.json` and `CHANGELOG.md`, commits and tags. Pushing the tag makes GitHub Actions build the extension and publish a release with the zip.

## Credits and licenses

The code is released under the [MIT License](LICENSE). The bundled data has its own licenses:

- `dict/jlpt.json`: the JLPT word lists with Chinese definitions from [anki-jlpt-decks](https://github.com/5mdld/anki-jlpt-decks) by egg rolls, under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/).
- `dict/jmdict-en.json`: English definitions from [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project), © the Electronic Dictionary Research and Development Group, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It is generated by `scripts/add-english-definitions.mjs` and shared under the same license.
- Japanese analysis uses [kuromoji.js](https://github.com/patdx/kuromoji.js) and its dictionary, under the Apache License 2.0.
