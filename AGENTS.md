# AGENTS Guide for `video-director`

## Big Picture (read this first)
- App is a standalone Angular 21 SPA bootstrapped with `bootstrapApplication` and zoneless change detection (via `provideZonelessChangeDetection()` in `src/app/app.config.ts`).
- Main product surface is the canvas editor page at `/recording-sessions/new` (`src/app/app.routes.ts`, `src/app/pages/recording-session-new/*`).
- Current state management is **Angular Signals in singleton services** (not NgRx SignalStore): `CanvasService`, `CanvasWidgetStateService`, `StreamStateService`; no external state management library.
- Geometry/math is intentionally decoupled into pure functions in `src/app/utils/canvas-geometry.utils.ts`; services orchestrate, utils compute.
- Use always English for label, code comments and variable names; this is a global team and codebase.
- Key npm dependencies: `uuid` (widget/stream IDs), `fflate` (compression for state serialization), `html-to-image` (canvas export), `rxjs` (event streams).

## Service Boundaries and Data Flow
- `CanvasService` is the orchestration layer for viewport, drag, resize, snapping, and selection state (`src/app/services/canvas.service.ts`); maintains `private state` (WritableSignal) and exposes computed signals for UI.
- `CanvasWidgetDragService` computes next widget position during drag, applying snapping logic (grid, objects, borders) and boundary clamping (`src/app/services/canvas-widget-drag.service.ts`).
- `CanvasWidgetResizeService` computes next widget size during resize, respecting constraints and snapping (`src/app/services/canvas-widget-resize.service.ts`).
- `CanvasDirective` wires global pointer/keyboard/wheel events, undo/redo shortcuts (Ctrl+Z, Ctrl+Shift+Z), and forwards to `CanvasService` (`src/app/directives/canvas.directive.ts`).
- `CanvasWidgetDirective` attaches drag start + creates 8 resize handles, then delegates to `CanvasService` (`src/app/directives/canvas-widget.directive.ts`).
- Widget data source is `CanvasWidgetStateService` (`list()` computed signal, sorted by z-index) and is rendered via `@for` in `recording-session-new.component.html`.
- Header controls are live bindings to `CanvasService` toggles/commands (zoom, center, snap switches) in `src/app/layout/header/header.component.html`.
- `StreamStateService` tracks active `MediaStream` sources with lifecycle hooks: `addStream()` registers `videoTrack.onended` listener to detect browser stop events; `stopStream()` stops all tracks and removes from state.

## Canvas/Viewport Rules You Must Preserve
- Always convert pointer screen coords to canvas coords through zoom-aware mapping (`screenToCanvasPoint` in `canvas-geometry.utils.ts`; `getPointerCanvasPoint` in `CanvasService`).
- Snap distances for objects/borders are scaled by zoom (`distance / zoom`) in drag computations; keep this when adding snapping behavior.
- Zoom toward cursor is implemented via focal-point math in `CanvasViewportService.zoomFromFocalPoint`; do not replace with naive center zoom.
- Pan supports space+drag (and pointer button logic) through `CanvasDirective.isPanTarget` + `CanvasService.canvasDrag*`.
- Visual guides (`objectSnapGuides`) are transient signal state rendered as axis lines in `recording-session-new.component.html`.

## Project Conventions (code style and patterns)
- Prefer `inject()` and signal APIs (`signal`, `computed`, `input`) over constructor-heavy patterns (seen across services/components/directives).
- **Change Detection:** All editor-facing components use `ChangeDetectionStrategy.OnPush` paired with zoneless change detection (`provideZonelessChangeDetection()`); this removes zone.js overhead and relies on signal updates to trigger renders. Ensure components mark inputs/state as signals.
- **Service State Pattern:** Services expose state as `private state: WritableSignal<T>` with public `computed()` derived signals for UI consumption (e.g., `list()` that sorts by z-index). This keeps mutation internal and prevents direct state writes from components.
- **Widget Types:** Supported widget content types are `'text'`, `'image'`, `'video'` (defined in `src/app/models/canvas-widget-state.models.ts`). Each type has specific properties (image: `src`, `alt`, `fitMode`; text: `text`, `style` with font/color/alignment; video: `srcObject` or stream).
- Use strict geometry types (`Point2D`, `Size2D`, `Rect2D`, `ResizeHandle`) from `src/app/models/geometry.models.ts`.
- Styling stack is SCSS + CSS vars under `src/scss/*`; no Tailwind config is present in this repo today.
- Linting enforces Angular selector conventions: element `app-*`, attribute `app*` (`eslint.config.js`).

## Developer Workflow (verified from repo config)
- Install: `npm install`
- Dev server: `npm start` (Angular dev server, default `http://localhost:4200`)
- Build: `npm run build` (prod), `npm run watch` (dev watch), `npm run build:github` (GitHub Pages base href)
- Quality checks: `npm run lint`, `npm test`
- Generator defaults in `angular.json` set `skipTests: true`; if you add important logic (especially geometry), add tests intentionally.

## Integration Points and Risks
- Browser media capture integration lives in `RecordingSessionNewComponent.newCaptureStream()` + `StreamStateService` (`navigator.mediaDevices.getDisplayMedia`, track `onended`); `StreamStateService.addStream()` automatically registers `videoTrack.onended` handler to detect when user clicks browser stop button.
- `CanvasService` updates DOM styles during drag/resize and commits final values back to signal state on pointer-up; keep this split for smooth interactions; widget signals remain stable until pointer-up to avoid re-renders mid-drag.
- `MathService.divisors()` and `divisorsInCommon()` build snap grid size options from canvas dimensions; verify snap list behavior when changing canvas dimensions (initialized in `CanvasDirective.ngOnInit` with default 1280×720).
- Route `/recording-sessions/:sessionId` exists but is minimal (`RecordingSessionComponent`), so editor work should target `/recording-sessions/new` unless task says otherwise.
- Undo/Redo is wired through `CanvasDirective` keyboard handlers (Ctrl+Z, Ctrl+Shift+Z) and calls `CanvasService.undo()`/`redo()`; state history is maintained in `CanvasService`.

