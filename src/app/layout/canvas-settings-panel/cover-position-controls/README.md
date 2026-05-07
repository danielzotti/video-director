# Cover Position Controls

## Overview
Cover position controls for image and video are extracted into a reusable
`CoverPositionControlsComponent`.

## Component API

### `cover-position-controls.component.ts`
- **Selector**: `app-cover-position-controls`
- **Inputs**:
  - `idPrefix: string` - Prefix used to generate unique input IDs
  - `offsetX: string` - Current X offset
  - `offsetY: string` - Current Y offset
- **Outputs**:
  - `anchorSelected: EventEmitter<CoverAnchor>` - Fired when an anchor is selected
  - `offsetXChanged: EventEmitter<number>` - Fired when X offset changes
  - `offsetYChanged: EventEmitter<number>` - Fired when Y offset changes

### Supported anchors
- `top-left`, `top-center`, `top-right`
- `center-left`, `center`, `center-right`
- `bottom-left`, `bottom-center`, `bottom-right`

Each anchor maps to predefined X/Y values.

## Parent usage
```html
<app-cover-position-controls
  idPrefix="image-cover"
  [offsetX]="imageCoverOffsetDraft().x"
  [offsetY]="imageCoverOffsetDraft().y"
  (anchorSelected)="setImageCoverAnchor($event)"
  (offsetXChanged)="onImageOffsetXChange($event)"
  (offsetYChanged)="onImageOffsetYChange($event)"
/>
```

## Notes
- The component is UI-only and does not depend on `CanvasService`.
- Inputs use signal-based APIs.
- Offset outputs emit numbers directly.

