# Working on Immersive Memorize

Read [README.md](README.md) for the features and the code layout. Run `npm run check` (type-check, lint, format check and tests) before committing, and try changes in Chrome by loading `dist/` after `npm run build`.

## Conventions

- English is the default language of the extension, the code and the documentation. Interface text goes through `t()` from `src/lib/i18n.ts`, with keys in `_locales/en/messages.json`. Add every key to `_locales/zh_CN/messages.json` as well. Chrome accepts only letters, digits and underscores in keys.
- Settings are typed in `src/lib/settings.ts` and stored in `chrome.storage.sync`. When their shape changes, migrate stored values the way `migrateLegacySettings` does; it runs every time the service worker starts.
- Cards live in IndexedDB. Extension pages and the service worker use `cardStore`; content scripts ask the service worker through `callBackground` (`src/lib/messages.ts`). Every card change bumps `cardsRevision` so that open pages and tabs refresh.
- Text from web pages and subtitle files never reaches `innerHTML` unchecked: subtitle files are rendered with `renderCueText`, and saved sentences go through `sanitizeSentenceHtml`.
- The kuromoji dictionaries are copied from `@patdx/kuromoji` at build time and decompressed at runtime, so they stay out of the repository.
- `dict/jlpt.json` (CC BY-NC 4.0) and `dict/jmdict-en.json` (CC BY-SA 4.0) have incompatible licenses and stay in separate files. Regenerate the English definitions with `scripts/add-english-definitions.mjs`.

## Releases

`npm version minor` (or `patch`) updates `manifest.json` and `CHANGELOG.md`, commits and tags. Pushing the tag builds the zip and publishes a GitHub release; the same zip is uploaded to the Chrome Web Store.
