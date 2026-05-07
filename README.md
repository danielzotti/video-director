# VideoDirector

A modern, high-performance canvas-based video recording editor built with **Angular 21** and **Signals**. VideoDirector allows users to create and manage recording sessions with an intuitive 2D canvas interface featuring resizable and draggable widgets, real-time snapping, zoom and pan controls, and seamless media stream integration.

## Features

- 🎥 **Canvas-based Editor** – Drag, resize, and position recording widgets on an infinite canvas
- ⚡ **Responsive Viewport** – Full zoom and pan support with focal-point zooming (toward cursor)
- 🔧 **Smart Snapping** – Snap-to-grid and snap-to-objects (alignment guides) for precise positioning
- 📐 **Boundary Enforcement** – Toggleable boundary constraints to keep widgets within canvas bounds
- 🎯 **Real-time State Management** – Angular Signals for performant reactive state with zero-dependency change detection
- 📹 **Media Integration** – Direct browser media capture support for screen recording
- 💾 **Project Persistence** – Automatic local snapshot persistence with undo/redo history
- 🗜️ **Project Import/Export** – Full project archive import/export via `.zip` (state + media assets)
- 📁 **Folder Sync Workflow** – Optional sync to a local project folder with manual sync/load/disconnect actions
- 🛟 **Import Safety Fallback** – Backup `.zip` generation when folder sync is skipped, cancelled, or unsupported
- 🎨 **Modern UI** – Built with SCSS and CSS Variables for dynamic styling

## Tech Stack

- **Framework:** [Angular 21](https://angular.dev) with Standalone Components
- **State Management:** Angular Signals with service-based architecture
- **Styling:** SCSS + CSS Variables for responsive canvas scaling
- **Utilities:** Pure TypeScript functions for geometry and collision detection
- **Build Tool:** Angular CLI with optimized production builds

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** (or your preferred package manager)
- A modern web browser with support for HTML5 Canvas and Media Stream API
- For local folder sync: browser support for the File System Access API (`showDirectoryPicker`)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/video-director.git
cd video-director
npm install
```

### Development Server

Start the local development server:

```bash
npm start
```

Navigate to `http://localhost:4200/` in your browser. The application will automatically refresh as you modify source files.

### Building

Build the project for production:

```bash
npm run build
```

Compiled artifacts are stored in the `dist/` directory.

### Code Quality

Run linting:

```bash
npm run lint
```

Run unit tests:

```bash
npm test
```

Watch mode for development:

```bash
npm run watch
```

## Quick Start: Project Sync

Get your project synced to a local folder in under 30 seconds:

1. Open the **Settings panel** (gear icon, right sidebar).
2. Scroll to the **Project** section at the bottom.
3. Enter a **Project name** (optional).
4. Click **Connect folder** → pick or create an empty folder on your computer.
5. Done — the project is immediately written to `<your-folder>/state.json` and `<your-folder>/assets/`.

From this point on, every change is automatically saved to that folder in the background.

> **Tip:** To share the project or back it up, use **Export project (.zip)** from the actions toolbar. To restore it on another machine, use **Import project (.zip)**.

---

## Project Persistence and Sync

VideoDirector supports a complete project persistence workflow, including local autosave, ZIP import/export, and optional synchronization to a folder on your computer.

### 1) Local Autosave (Always On)

- Editor state is persisted locally in browser storage after changes.
- Undo/redo snapshots are tracked in memory to support editing history.
- This works even when no project folder is connected.

### 2) Export / Import Project Archive (`.zip`)

- Use the actions toolbar to:
  - **Export project (.zip)**
  - **Import project (.zip)**
- Exported archives contain a `sync/` directory with:
  - `sync/state.json` (canvas + widgets state)
  - `sync/assets/*` (managed image/video files)

### 3) Local Folder Sync (Project Section in Settings Panel)

- In **Project → Project folder sync**, you can:
  - **Connect folder**
  - **Sync now**
  - **Load from folder**
  - **Disconnect**
- When connected, project changes are automatically synced to the selected folder (debounced writes).
- Sync status is surfaced in the UI (`idle`, `syncing`, `error`) with pending-changes feedback.

### 4) Import + Sync Behavior

When importing a `.zip`, the app can also persist imported files to a selected local folder.

- If folder write succeeds: project is imported and synced immediately.
- If folder write is skipped/cancelled/unsupported: project is still imported in memory, and a **backup zip** can be saved manually.
- The setting **"Ask folder on zip import"** controls whether the folder picker is shown during import.

### 5) Browser Compatibility Notes

- Local folder sync depends on File System Access API availability and granted permissions.
- If unavailable, the editor still supports full `.zip` import/export and local browser persistence.

## Deploying to GitHub Pages

VideoDirector includes a convenient setup for deploying to GitHub Pages. Follow these steps:

### 1. Configure Your Repository

Ensure your repository is set up on GitHub as a **public** or **private** (with GitHub Pages enabled) repository.

### 2. Install gh-pages

The `gh-pages` package is used for deployment. It's included in the project's dev dependencies.

### 3. Deploy

Run the deployment command:

```bash
npm run deploy
```

This command will:
1. Build the project with the GitHub Pages base href (`/video-director/`)
2. Deploy the compiled application to the `gh-pages` branch
3. Make it live at `https://yourusername.github.io/video-director/`

### 4. Verify Deployment

After running `npm run deploy`, visit your GitHub repository settings:
- Navigate to **Settings** → **Pages**
- Confirm that the branch is set to `gh-pages` and the source is `/ (root)`
- Your site should be live within moments

### Automatic Updates

To keep your GitHub Pages deployment up to date, simply run `npm run deploy` whenever you want to publish changes.

### More About GitHub Pages

For detailed information about GitHub Pages hosting, see the [official GitHub Pages documentation](https://docs.github.com/en/pages).

## Project Structure

```
src/
├── app/
│   ├── components/       # UI components (widgets, video stream, debug panel)
│   ├── directives/       # Canvas and widget interaction directives
│   ├── layout/           # Layout components (header, toolbar, panels)
│   ├── models/           # TypeScript interfaces for geometry and state
│   ├── pages/            # Page-level components (recording session editor)
│   ├── services/         # State management and business logic
│   ├── ui/               # Reusable UI primitives (buttons, toggles, etc.)
│   └── utils/            # Pure utility functions for geometry calculations
├── scss/                 # Global styles and CSS variables
└── index.html            # Root HTML file
```

## Architecture Overview

### Canvas System

The canvas operates in two coordinate spaces:

- **Screen Space**: Mouse and pointer coordinates as reported by the browser
- **Canvas Space**: Coordinates within the editor canvas, accounting for zoom and pan

All geometry calculations are decoupled into pure, testable utility functions in `src/app/utils/canvas-geometry.utils.ts`, while services orchestrate the interactions.

### State Management

State is managed through Angular Signals and singleton services:

- **CanvasService**: Orchestrates viewport, drag, resize, snapping, and selection
- **CanvasWidgetStateService**: Manages widget list and individual widget state
- **CanvasViewportService**: Handles zoom and pan transformations
- **StreamStateService**: Manages media capture state

### Rendering

The application uses OnPush change detection strategy for optimal performance, rendering widgets dynamically via Angular's `@for` directive with signal-based inputs.

## Usage Tips

- **Drag Widgets**: Click and drag any widget on the canvas to move it
- **Resize Widgets**: Grab the corner or edge handles to resize
- **Zoom**: Scroll with the mouse wheel to zoom toward the cursor
- **Pan**: Hold space and drag, or use middle mouse button to pan
- **Snapping**: Enable snap-to-grid or snap-to-objects from the header controls
- **Boundary Checks**: Toggle boundary enforcement to allow or prevent widgets from leaving the canvas
- **Project Sync**: Connect a local folder from the settings panel to keep `sync/state.json` and `sync/assets` updated
- **Import Safety**: If folder sync is unavailable during import, use the backup zip action to avoid losing sync artifacts

## Contributing

Contributions are welcome! Please ensure:

- Code follows the linting rules (`npm run lint`)
- Changes maintain the existing architecture patterns
- Geometry logic is kept in pure utility functions
- Components use Signal-based APIs

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Resources

- [Angular 21 Documentation](https://angular.dev)
- [Angular Signals Guide](https://angular.dev/guide/signals)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
