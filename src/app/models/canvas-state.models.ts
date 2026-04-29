import {Point2D, Size2D} from './geometry.models';

export interface CanvasState extends Point2D, Size2D {
  uuid?: string;
  zoom: number;
}

export interface CanvasStateSizeAndPosition extends Point2D, Size2D {}
