import {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  SeriesAttachedParameter,
  PrimitivePaneViewZOrder
} from 'lightweight-charts';

interface Point {
  time: number;
  price: number;
}

interface RectangleData {
  topLeft: Point;
  bottomRight: Point;
  color: string;
  id: string;
}

class RectanglePaneRenderer implements IPrimitivePaneRenderer {
  private _data: RectangleData | null = null;
  private _pixelData: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null = null;

  constructor(data: RectangleData | null, pixelData: { x1: number; y1: number; x2: number; y2: number; } | null) {
    this._data = data;
    this._pixelData = pixelData;
  }

  draw(target: any): void {
    if (!this._data || !this._pixelData) return;

    // Check if target has the expected structure
    if (!target || !target.canvasRenderingContext2D) {
      console.error('Invalid canvas target:', target);
      return;
    }

    const ctx = target.canvasRenderingContext2D;
    const pixelRatio = target.pixelRatio || 1;
    
    // Scale coordinates for pixel ratio
    const x1 = this._pixelData.x1 * pixelRatio;
    const y1 = this._pixelData.y1 * pixelRatio;
    const x2 = this._pixelData.x2 * pixelRatio;
    const y2 = this._pixelData.y2 * pixelRatio;

    try {
      // Draw rectangle outline
      ctx.save();
      ctx.strokeStyle = this._data.color;
      ctx.lineWidth = 2 * pixelRatio;
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      ctx.stroke();

      // Draw semi-transparent fill
      ctx.fillStyle = this._data.color + '20'; // Add transparency
      ctx.fill();

      ctx.restore();
    } catch (error) {
      console.error('Error drawing rectangle:', error);
    }
  }
}

class RectanglePaneView implements IPrimitivePaneView {
  private _data: RectangleData | null = null;
  private _source: RectangleDrawingTool;

  constructor(source: RectangleDrawingTool) {
    this._source = source;
  }

  update(data: RectangleData | null): void {
    this._data = data;
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._data) return null;

    const timeScale = this._source.chart.timeScale();
    const series = this._source.series;

    // Convert logical coordinates to pixels
    const x1 = timeScale.timeToCoordinate(this._data.topLeft.time as any);
    const y1 = series.priceToCoordinate(this._data.topLeft.price);
    const x2 = timeScale.timeToCoordinate(this._data.bottomRight.time as any);
    const y2 = series.priceToCoordinate(this._data.bottomRight.price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) {
      return null;
    }

    return new RectanglePaneRenderer(this._data, { x1, y1, x2, y2 });
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'normal';
  }
}

export class RectangleDrawingTool implements ISeriesPrimitive<any> {
  private _paneView: RectanglePaneView;
  private _data: RectangleData | null = null;
  private _requestUpdate?: () => void;
  public chart: any;
  public series: any;

  constructor() {
    this._paneView = new RectanglePaneView(this);
  }

  attached(param: SeriesAttachedParameter<any>): void {
    this.chart = param.chart;
    this.series = param.series;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = undefined;
    this.series = undefined;
    this._requestUpdate = undefined;
  }

  updateAllViews(): void {
    this._paneView.update(this._data);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }

  // Public methods to control the rectangle
  setData(data: RectangleData | null): void {
    this._data = data;
    this.updateAllViews();
    this._requestUpdate?.();
  }

  getData(): RectangleData | null {
    return this._data;
  }
}

export { Point, RectangleData };