# AGENTS Guide for `video-director`

## Big Picture (read this first)
- App is a standalone Angular 21 SPA bootstrapped with `bootstrapApplication` and zoneless change detection (`src/main.ts`, `src/app/app.config.ts`).
- Main product surface is the canvas editor page at `/recording-sessions/new` (`src/app/app.routes.ts`, `src/app/pages/recording-session-new/*`).
- Current state management is Angular Signals in singleton services (not NgRx store yet): `CanvasService`, `CanvasWidgetStateService`, `StreamStateService`.
- Geometry/math is intentionally decoupled into pure functions in `src/app/utils/canvas-geometry.utils.ts`; services orchestrate, utils compute.

## Service Boundaries and Data Flow
- `CanvasService` is the orchestration layer for viewport, drag, resize, snapping, and selection state (`src/app/services/canvas.service.ts`).
- `CanvasDirective` wires global pointer/keyboard/wheel events and forwards to `CanvasService` (`src/app/directives/canvas.directive.ts`).
- `CanvasWidgetDirective` attaches drag start + creates 8 resize handles, then delegates to `CanvasService` (`src/app/directives/canvas-widget.directive.ts`).
- Widget data source is `CanvasWidgetStateService` (`list()` computed signal) and is rendered via `@for` in `recording-session-new.component.html`.
- Header controls are live bindings to `CanvasService` toggles/commands (zoom, center, snap switches) in `src/app/layout/header/header.component.html`.

## Canvas/Viewport Rules You Must Preserve
- Always convert pointer screen coords to canvas coords through zoom-aware mapping (`screenToCanvasPoint` in `canvas-geometry.utils.ts`; `getPointerCanvasPoint` in `CanvasService`).
- Snap distances for objects/borders are scaled by zoom (`distance / zoom`) in drag computations; keep this when adding snapping behavior.
- Zoom toward cursor is implemented via focal-point math in `CanvasViewportService.zoomFromFocalPoint`; do not replace with naive center zoom.
- Pan supports space+drag (and pointer button logic) through `CanvasDirective.isPanTarget` + `CanvasService.canvasDrag*`.
- Visual guides (`objectSnapGuides`) are transient signal state rendered as axis lines in `recording-session-new.component.html`.

## Project Conventions (code style and patterns)
- Prefer `inject()` and signal APIs (`signal`, `computed`, `input`) over constructor-heavy patterns (seen across services/components/directives).
- Use strict geometry types (`Point2D`, `Size2D`, `Rect2D`, `ResizeHandle`) from `src/app/models/geometry.models.ts`.
- Keep components thin and `OnPush` for editor-facing UI (`App`, `WidgetComponent`, `RecordingSessionNewComponent`).
- Styling stack is SCSS + CSS vars under `src/scss/*`; no Tailwind config is present in this repo today.
- Linting enforces Angular selector conventions: element `app-*`, attribute `app*` (`eslint.config.js`).

## Developer Workflow (verified from repo config)
- Install: `npm install`
- Dev server: `npm start` (Angular dev server, default `http://localhost:4200`)
- Build: `npm run build` (prod), `npm run watch` (dev watch), `npm run build:github` (GitHub Pages base href)
- Quality checks: `npm run lint`, `npm test`
- Generator defaults in `angular.json` set `skipTests: true`; if you add important logic (especially geometry), add tests intentionally.

## Integration Points and Risks
- Browser media capture integration lives in `RecordingSessionNewComponent.newCaptureStream()` + `StreamStateService` (`navigator.mediaDevices.getDisplayMedia`, track `onended`).
- `CanvasService` updates DOM styles during drag/resize and commits final values back to signal state on pointer-up; keep this split for smooth interactions.
- `MathService.divisors()` currently builds snap options and can affect snap-size UI in header; verify snap list behavior when changing canvas dimensions.
- Route `/recording-sessions/:sessionId` exists but is minimal (`RecordingSessionComponent`), so editor work should target `/recording-sessions/new` unless task says otherwise.

