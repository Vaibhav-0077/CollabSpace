# CollabSpace 🎨
### AI-Powered Real-Time Collaborative Whiteboard

> A modern, free, and open-source visual collaboration canvas that combines the tactile speed of **Excalidraw** with the structured diagramming elegance of **Miro** — featuring zero-friction instant access and deterministic AI flowchart generation.

---

## ✨ Key Features

- **🚀 Zero Login Barrier**: Open a link and start drawing within 2 seconds. No sign-up, password, or OAuth walls.
- **🎨 Infinite Retina Canvas**: Powered by Fabric.js 7 with automatic HiDPI pixel scaling, smooth mouse-wheel zoom-to-pointer, and spacebar panning.
- **⚡ AI-Assisted Diagramming**: Convert plain-English prompts (e.g. *"Microservice auth flow"*, *"User onboarding tree"*) into clean, structured diagrams using a deterministic topological layout pipeline.
- **📌 Interactive Shapes & Sticky Notes**: Rectangles, circles, decision diamonds, auto-expanding sticky notes, freehand drawing with stroke smoothing, and text.
- **🪄 Floating Contextual Mini-Bar**: Floats above selected objects with 8 curated pastel colors, stroke options, duplicate, and delete.
- **👥 Real-Time Collaboration**: Shareable cryptographic room URLs (`/b/:roomId`), guest nicknames, and multi-user presence.
- **💾 Export Anything**: Export high-resolution 2x Retina PNGs, SVGs, or lossless JSON board states.
- **🌙 Dark & Light Themes**: Carefully crafted modern glassmorphic interface with sleek tokens and Lucide icons.

---

## 🛠️ Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Canvas Rendering Engine**: Fabric.js 7 (Retina Scene Graph & Headless Object Caching)
- **State Management**: Zustand
- **Icons**: Lucide React
- **Styling**: Modern Vanilla CSS with glassmorphic tokens & dark/light themes
- **Real-Time Engine**: Socket.IO (under `server/`)
- **Backend & Database**: Node.js + Express + PostgreSQL

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- npm or pnpm

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/collabspace.git
cd collabspace
```

### 2. Run the Frontend Client
```bash
cd client
npm install
npm run dev
```

Visit **`http://localhost:5173/`** in your browser.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
