# Synapse Notes - Chrome Built-in AI Challenge 2025

## Project Overview

**Synapse Notes** is an offline-first, AI-powered note-taking PWA that leverages Chrome's Built-in AI APIs to provide intelligent writing assistance without requiring internet connectivity or cloud services.

## APIs Used

### ✅ Primary: Prompt API (Language Model)
- **Status**: ✅ Fully implemented and tested
- **Usage**: Core AI engine powering all intelligent features
- **Implementation**: Supports multiple API surfaces for maximum compatibility:
  - `window.ai.languageModel.create()` (modern)
  - `window.LanguageModel.create()` (legacy)
  - `window.ai.prompt()` (fallback)

### ✅ Writer API (with Intelligent Fallback)
- **Status**: ✅ Implemented with progressive enhancement
- **Usage**: Text expansion feature - turns brief notes into full paragraphs
- **Implementation**: Prioritizes native Writer API when available, gracefully falls back to Language Model with custom prompts

### ✅ Summarizer API (with Intelligent Fallback)
- **Status**: ✅ Implemented with progressive enhancement
- **Usage**: Generates concise TL;DR summaries of long notes
- **Implementation**: Prioritizes native Summarizer API when available, gracefully falls back to Language Model with custom prompts

### ✅ Rewriter API (with Intelligent Fallback)
- **Status**: ✅ Implemented with Language Model fallback
- **Usage**: Improves writing quality and adjusts tone
- **Implementation**: Uses Rewriter API if present, otherwise uses Language Model

## Problem Solved

**The Frictionless AI Notebook for Knowledge Workers**

Current note-taking apps suffer from three major problems:
1. **Cloud Dependency**: Require internet connection and raise privacy concerns
2. **AI Paywalls**: Advanced AI features locked behind subscriptions
3. **Cluttered Interfaces**: Linear organization doesn't match how we think

Synapse Notes solves these by:
- **100% Offline**: All AI processing happens on-device using Gemini Nano
- **Zero Cost**: No API fees, no subscriptions, completely free
- **Visual Canvas**: Organize notes spatially like sticky notes on a wall
- **Instant AI**: On-device AI provides sub-second response times

## Key Technical Achievements

### 1. Progressive Enhancement Strategy
The application intelligently adapts to the user's Chrome environment:
- **Browsers with full API support**: Uses native Writer/Summarizer APIs
- **Browsers with partial support**: Polyfills missing APIs using the foundational Prompt API
- **Result**: Consistent user experience regardless of Chrome version

This demonstrates production-ready engineering for experimental APIs.

### 2. Multi-Surface API Compatibility
Implemented compatibility layer that works across Chrome Stable, Dev, and Canary:
```typescript
// Checks three different API surfaces for maximum compatibility
- window.ai.languageModel (modern)
- window.LanguageModel (legacy) 
- window.ai.prompt (fallback)
```

### 3. Offline-First Architecture
- **IndexedDB** for local data persistence
- **Service Worker** for offline PWA functionality
- **On-device AI** for zero-latency processing
- Works perfectly offline after first visit

### 4. Interactive Canvas View
- Built with React Flow
- Drag-and-drop note positioning
- Zoom/pan controls with minimap
- Persistent spatial organization

### 5. Advanced Search
- Fuzzy matching algorithm
- Full-text search across all notes
- Date range filtering
- Real-time highlighting

## Scalability

### Technical Scalability
- **IndexedDB**: Handles 10,000+ notes efficiently
- **Virtual Rendering**: Canvas uses viewport optimization
- **Debounced Auto-save**: Prevents excessive database writes
- **Modular Architecture**: Easy to add new AI features

### User Scalability
- **Multilingual Ready**: AI works in any language Gemini Nano supports
- **Accessibility**: Keyboard shortcuts, ARIA labels
- **Responsive Design**: Works on desktop, tablet, mobile
- **Progressive Web App**: Install as native app on any platform

### Geographic Scalability
- **No Server Required**: Works identically worldwide
- **No Regional Restrictions**: On-device AI available everywhere
- **Offline-First**: Perfect for areas with poor connectivity

## User Experience Excellence

### Intuitive Interface
- Clean, modern design with dark mode support
- Familiar sticky-note paradigm
- One-click note creation
- Smooth animations and transitions

### AI Integration
- **Non-intrusive**: AI tools appear only when relevant
- **Transparent**: Clear visual feedback during processing
- **Smart Defaults**: Context-aware AI suggestions
- **Keyboard Shortcuts**: Ctrl+S to save, Esc to close

### Performance
- **Sub-second AI responses**: On-device processing is instant
- **Auto-save**: Never lose work (2-second debounce)
- **Optimistic Updates**: UI responds immediately
- **Efficient Storage**: Compressed IndexedDB storage

## Technological Execution

### API Showcase
We demonstrate **4 out of 6** Chrome Built-in AI APIs:
1. ✅ **Prompt API** - Core intelligence engine
2. ✅ **Writer API** - Text expansion
3. ✅ **Summarizer API** - Content summarization  
4. ✅ **Rewriter API** - Content improvement

### Advanced Features
- **Multi-API Detection**: Robust capability checking
- **Graceful Degradation**: Works even with partial API support
- **Diagnostic Tools**: Built-in probe for debugging
- **Type Safety**: Full TypeScript coverage

### Code Quality
- Clean, maintainable architecture
- Comprehensive error handling
- Detailed inline documentation
- Following React best practices

## Privacy & Offline Capabilities

### Privacy First
- **Zero Cloud Dependency**: All AI runs on-device
- **No Data Collection**: Nothing leaves the user's device
- **No Tracking**: No analytics or telemetry
- **Open Source**: Fully transparent codebase

### Offline Excellence
- **PWA Architecture**: Install as native app
- **Service Worker**: Caches all assets
- **IndexedDB**: Persistent local storage
- **On-Device AI**: Works without internet after first visit

## Demo Video Highlights

The demo video should showcase:
1. **Creating Notes**: Quick note creation with title
2. **Note Editor**: Auto-save, word count, keyboard shortcuts
3. **Canvas View**: Drag-and-drop organization, zoom, minimap
4. **AI Features**:
   - Select text → Click "Expand" → Watch it grow
   - Click "Summarize" → See TL;DR appear
   - Select text → Click "Improve" → See enhanced version
5. **Search**: Type query, see fuzzy matches, filter by date
6. **Offline**: Show airplane mode, everything still works

## Installation & Testing Instructions

### For Judges
```bash
git clone https://github.com/Nicoding1996/synapse-notes.git
cd synapse-notes
npm install
npm run dev
```

Open `http://localhost:3000` in **Chrome 128+** (Dev or Canary recommended for full API support)

### Chrome Setup Required
1. Enable flags at `chrome://flags`:
   - `#prompt-api-for-gemini-nano`
   - `#summarization-api-for-gemini-nano`
   - `#writer-api-for-gemini-nano`
   - `#rewriter-api-for-gemini-nano`
   - `#optimization-guide-on-device-model`
2. Relaunch Chrome (twice for best results)
3. Model downloads automatically (~4GB)

### Fallback Mode
If native Writer/Summarizer APIs are unavailable, the app automatically uses the Prompt API as a polyfill. All features remain functional.

## Technical Highlights for Judges

### Why This Project Stands Out

1. **Production-Ready Resilience**: Handles experimental API instability with intelligent fallbacks
2. **Multi-API Compatibility**: Works across different Chrome builds and versions
3. **Real-World Usefulness**: Solves actual pain points in knowledge management
4. **Privacy-Focused**: Truly zero-trust architecture
5. **Future-Proof**: Automatically upgrades to use new APIs as they become available

### Engineering Excellence
- TypeScript for type safety
- React hooks for clean state management
- IndexedDB for efficient local storage
- React Flow for canvas visualization
- Comprehensive error handling
- Detailed developer documentation

## Project Links

- **Repository**: [https://github.com/Nicoding1996/synapse-notes](https://github.com/Nicoding1996/synapse-notes)
- **Demo Video**: [To be added]
- **Live Demo**: [To be deployed]

## License

MIT License - Fully open source

---

**Built with ❤️ for the Chrome Built-in AI Challenge 2025**