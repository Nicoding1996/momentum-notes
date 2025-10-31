# 🧠 Synapse Notes

> **The AI-Powered Knowledge Network. Connect Your Ideas.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Built with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-Enabled-5A0FC8)](https://web.dev/progressive-web-apps/)

Synapse Notes is an innovative Progressive Web App (PWA) that leverages Chrome's built-in Gemini Nano AI to provide a seamless, offline-first note-taking experience. Organize your thoughts on an infinite visual canvas, create meaningful connections between ideas, and let AI enhance your productivity—all without ever needing an internet connection.

---

## ✨ Key Features

### 🌐 **Offline-First Architecture**
- Works 100% offline after the first visit
- All data stored locally on your device using IndexedDB
- No internet connection required for core features
- Automatic background sync when online

### 🤖 **AI-Powered Intelligence**
Powered by Chrome's Built-in AI APIs (Gemini Nano):
- 🎤 **Voice Transcription**: Instantly convert voice memos to text using Web Speech API
- ✍️ **Smart Writing**: Expand ideas into full paragraphs
- 🔄 **Content Rewriting**: Adjust tone and improve writing quality
- 📝 **Auto-Summarization**: Generate concise TL;DR summaries
- 🔗 **AI-Powered Connections**: Automatically discover semantic relationships between notes
- 🎯 **Context-Aware**: All AI features understand your note's content and tags

### 🎨 **Visual Canvas Interface**
- Infinite canvas for organizing thoughts spatially
- Mixed-media blocks: text, images, audio
- Drag-and-drop organization like sticky notes
- Mind mapping and relationship visualization
- Zoom, pan, and multi-select capabilities

### ♿ **Accessibility First**
- WCAG 2.1 Level AA compliant
- Full keyboard navigation
- Screen reader optimized
- AI-generated alt-text for images
- High contrast mode support

### 🔒 **Privacy by Design**
- All AI processing happens on your device
- No data sent to cloud unless you choose to
- Optional end-to-end encryption
- Open-source and transparent

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/pnpm/yarn
- **Chrome** 128+ (for Gemini Nano AI features)
- **Git** for version control

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Nicoding1996/synapse-notes.git
cd synapse-notes
```

2. **Install dependencies**
```bash
npm install
# or
pnpm install
# or
yarn install
```

3. **Start development server**
```bash
npm run dev
```

4. **Open in browser**
Navigate to `http://localhost:5173` (or the port specified in your terminal)

5. **Install as PWA**
Click the install icon in your browser's address bar

---

## 📦 Project Structure

```
synapse-notes/
├── public/               # Static assets (icons, etc.)
├── src/
│   ├── components/       # React components
│   │   └── ui/           # Reusable UI components
│   ├── contexts/         # React Context providers
│   ├── extensions/       # Tiptap editor extensions
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Core libraries (DB, AI, etc.)
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Main App component
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles (Tailwind)
├── .gitignore            # Git ignore file
├── index.html            # Main HTML file
├── package.json          # Project dependencies and scripts
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

---

## 🛠️ Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Technology Stack

#### Core
- **React 18** - UI library with hooks
- **TypeScript 5** - Type safety
- **Vite** - Fast build tool and dev server

#### Styling
- **Tailwind CSS** - Utility-first CSS
- **Lucide React** - Beautiful icon library

#### State Management
- **Zustand** - Lightweight state management
- **TanStack Query** - Server state management
- **Immer** - Immutable state updates

#### Data & Storage
- **Dexie.js** - IndexedDB wrapper
- **Workbox** - Service Worker utilities
- **vite-plugin-pwa** - PWA support

#### Editor & Canvas
- **Tiptap** - Headless text editor framework
- **React Flow** - Interactive node-based UI

#### AI Integration
- Chrome Built-in AI APIs (Gemini Nano)

#### Testing
- **Vitest** - Unit testing
- **Testing Library** - Component testing
- **Playwright** - E2E testing

---

## 🎯 Roadmap

### Phase 1: MVP (Completed)
- [x] Project setup and architecture
- [x] Core note-taking functionality (create, edit, auto-save)
- [x] Offline-first data storage (IndexedDB)
- [x] Visual canvas with drag-and-drop
- [x] Chrome AI integration (Prompt, Writer, Summarizer, Rewriter)
- [x] Voice transcription (Web Speech API)
- [x] AI-powered note connections with relationship types
- [x] PWA installation with proper icons and shortcuts
- [x] Advanced search with fuzzy matching
- [x] Tag system for organization

### Phase 2: Enhanced Features (In Progress)
- [ ] Image OCR integration
- [ ] Translation API integration
- [ ] Proofreader API integration
- [ ] Template system
- [ ] Enhanced knowledge graph visualization
- [ ] Import from other note apps (Evernote, Notion, etc.)

### Phase 3: Integration (Future)
- [ ] Google Docs OAuth integration
- [ ] One-way export to Google Docs
- [ ] Conflict resolution UI
- [ ] Background sync queue
- [ ] Optional encryption layer
- [ ] Performance optimization for 10k+ notes

### Phase 4: Advanced (Future)
- [ ] Two-way Google Docs sync
- [ ] Real-time collaboration (WebRTC)
- [ ] Template marketplace
- [ ] Plugin system
- [ ] Mobile app (Capacitor)
- [ ] Online AI features (optional)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Run `npm run format` before committing
- Write tests for new features
- Update documentation as needed

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Chrome Built-in AI Team** - For the amazing on-device AI capabilities
- **Vite Team** - For the blazing-fast build tool
- **React Team** - For the excellent UI library
- **Tailwind CSS** - For the fantastic utility framework
- **Open Source Community** - For all the incredible tools and libraries

---

## 📧 Contact

- **GitHub**: [@Nicoding1996](https://github.com/Nicoding1996)
- **Issues**: [GitHub Issues](https://github.com/Nicoding1996/synapse-notes/issues)

---

**Built with ❤️ by the Synapse team**

*Powered by Chrome Built-in AI • 100% Offline • Privacy First*