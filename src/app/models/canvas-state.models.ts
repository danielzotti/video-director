export interface CanvasState extends CanvasStatePosition, CanvasStateSize {
  uuid?: string;
  zoom: number;
}

export interface CanvasStatePosition {
  x: number;
  y: number;
}

export interface CanvasStateSize {
  width: number;
  height: number;
}

export interface CanvasStateSizeAndPosition extends CanvasStatePosition, CanvasStateSize {

}
