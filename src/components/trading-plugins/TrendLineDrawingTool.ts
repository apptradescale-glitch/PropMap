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

interface TrendLineData {
  point1: Point;
  point2: Point;
  color: string;
  lineWidth: number;
  id: string;
}

class TrendLinePaneRenderer implements IPrimitivePaneRenderer {
  private _data: TrendLineData | null = null;
  private _pixelData: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null = null;

  constructor(data: TrendLineData | null, pixelData: { x1: number; y1: number; x2: number; y2: number; } | null) {
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
      // Draw trend line
      ctx.save();
      ctx.strokeStyle = this._data.color;
      ctx.lineWidth = this._data.lineWidth * pixelRatio;
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Draw end points
      const pointRadius = 4 * pixelRatio;
      
      // Point 1
      ctx.beginPath();
      ctx.arc(x1, y1, pointRadius, 0, 2 * Math.PI);
      ctx.fillStyle = this._data.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 * pixelRatio;
      ctx.stroke();

      // Point 2
      ctx.beginPath();
      ctx.arc(x2, y2, pointRadius, 0, 2 * Math.PI);
      ctx.fillStyle = this._data.color;
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    } catch (error) {
      console.error('Error drawing trend line:', error);
    }
  }
}

class TrendLinePaneView implements IPrimitivePaneView {
  private _data: TrendLineData | null = null;
  private _source: TrendLineDrawingTool;

  constructor(source: TrendLineDrawingTool) {
    this._source = source;
  }

  update(data: TrendLineData | null): void {
    this._data = data;
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._data) return null;

    const timeScale = this._source.chart.timeScale();
    const series = this._source.series;

    // Convert logical coordinates to pixels
    const x1 = timeScale.timeToCoordinate(this._data.point1.time as any);
    const y1 = series.priceToCoordinate(this._data.point1.price);
    const x2 = timeScale.timeToCoordinate(this._data.point2.time as any);
    const y2 = series.priceToCoordinate(this._data.point2.price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) {
      return null;
    }

    return new TrendLinePaneRenderer(this._data, { x1, y1, x2, y2 });
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'normal';
  }
}

export class TrendLineDrawingTool implements ISeriesPrimitive<any> {
  private _paneView: TrendLinePaneView;
  private _data: TrendLineData | null = null;
  private _requestUpdate?: () => void;
  public chart: any;
  public series: any;

  constructor() {
    this._paneView = new TrendLinePaneView(this);
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

  // Public methods to control the trend line
  setData(data: TrendLineData | null): void {
    this._data = data;
    this.updateAllViews();
    this._requestUpdate?.();
  }

  getData(): TrendLineData | null {
    return this._data;
  }
}

export { Point, TrendLineData };