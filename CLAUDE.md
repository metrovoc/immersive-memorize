# CLAUDE.md

总是中文回复

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension (Manifest V3) for learning Japanese vocabulary from Netflix content. It provides immersive learning through intelligent subtitle monitoring, sequential vocabulary highlighting, and contextual flashcard creation with screenshots.

## Development Commands

### Build and Development

- `npm run build` - Production build using Webpack
- `npm run dev` - Development build with watch mode
- `npm run type-check` - TypeScript type checking (no emit)
- `npm run lint` - ESLint for TypeScript files
- `npm run format` - Prettier formatting

### Testing the Extension

1. Run `npm run build` or `npm run dev`
2. Load `dist/` folder as unpacked extension in Chrome
3. Visit netflix.com to test functionality
4. Check browser console and extension popup for debugging

## Architecture

### Core Components

- **Content Script** (`src/content-script/index.ts`): Netflix page integration, subtitle monitoring, vocabulary highlighting, flashcard creation
- **Popup** (`src/popup/`): Flashcard management interface with React components
- **Options** (`src/options/`): Settings page for vocabulary list and hotkey configuration
- **Components** (`src/components/ui/`): Reusable React components using Tailwind + class-variance-authority

### Key Technologies

- **TypeScript**: Strict type checking enabled
- **React 18**: For popup and options UI
- **Tailwind CSS**: Utility-first styling with PostCSS processing
- **Webpack**: Module bundling with TypeScript and CSS processing
- **Chrome Storage API**: Data persistence

### Data Flow

1. User configures JLPT vocabulary list via options page
2. Content script loads vocabulary and learning progress
3. MutationObserver monitors Netflix subtitles in real-time
4. Sequential learning: highlights first unlearned word per subtitle
5. Hotkey capture creates FlashCard with screenshot + context
6. Popup interface manages saved cards and CSV export

### File Structure

- `manifest.json`: Extension configuration (Manifest V3)
- `dict/jlpt.json`: JLPT vocabulary database with readings/definitions
- `src/types/index.ts`: Core type definitions (FlashCard, ExtensionSettings)
- `src/content-script/`: Netflix integration logic
- `src/popup/` & `src/options/`: React-based UI pages
- `src/components/ui/`: Reusable UI components
- `dist/`: Build output directory

### Development Patterns

- Path aliases: `@/` maps to `src/`
- React components use forwardRef pattern
- CSS classes managed through clsx utility
- Chrome extension APIs typed with `@types/chrome`
- All builds output to `dist/` with source maps

### Key Features Implementation

- **Sequential Learning**: One highlighted word at a time to avoid cognitive overload
- **Visual Feedback**: Pulsing orange highlights with toast notifications
- **Multi-dimensional Capture**: Screenshot + sentence context + timestamp
- **Anki Integration**: CSV export format compatible with Anki import
