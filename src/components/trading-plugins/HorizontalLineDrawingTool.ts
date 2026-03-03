import {
  ISeriesPrimitive,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  PrimitivePaneViewZOrder
} from 'lightweight-charts';

interface HorizontalLineData {
  price: number;
  color: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  id: string;
  title?: string;
}

class HorizontalLinePaneRenderer implements IPrimitivePaneRenderer {
  private _data: HorizontalLineData | null = null;
  private _y: number | null = null;
  private _width: number = 0;

  constructor(data: HorizontalLineData | null, y: number | null, width: number) {
    this._data = data;
    this._y = y;
    this._width = width;
  }

  draw(target: any): void {
    if (!this._data || this._y === null) return;

    // Check if target has the expected structure
    if (!target || !target.canvasRenderingContext2D) {
    
      return;
    }

    const ctx = target.canvasRenderingContext2D;
    const pixelRatio = target.pixelRatio || 1;
    const y = this._y * pixelRatio;
    const width = this._width * pixelRatio;

    try {
      ctx.save();
      ctx.strokeStyle = this._data.color;
      ctx.lineWidth = this._data.lineWidth * pixelRatio;

      // Set line style
      switch (this._data.lineStyle) {
        case 'dashed':
          ctx.setLineDash([10 * pixelRatio, 5 * pixelRatio]);
          break;
        case 'dotted':
          ctx.setLineDash([2 * pixelRatio, 3 * pixelRatio]);
          break;
        default:
          ctx.setLineDash([]);
      }
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      ctx.restore();
    } catch (error) {
      console.error('Error drawing horizontal line:', error);
    }
  }
}

class HorizontalLinePaneView implements IPrimitivePaneView {
  private _data: HorizontalLineData | null = null;
  private _source: HorizontalLineDrawingTool;

  constructor(source: HorizontalLineDrawingTool) {
    this._source = source;
  }

  update(data: HorizontalLineData | null): void {
    this._data = data;
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._data) return null;

    const timeScale = this._source.chart.timeScale();
    const series = this._source.series;

    // Convert logical coordinates to pixels
    const y = series.priceToCoordinate(this._data.price);

    if (y === null) {
      console.log('❌ Could not convert price to coordinate:', this._data.price);
      return null;
    }

    // Get the chart width
    const width = timeScale.width();
    
    console.log('📏 Horizontal line renderer:', { 
      price: this._data.price, 
      y, 
      width,
      color: this._data.color 
    });

    return new HorizontalLinePaneRenderer(this._data, y, width);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'normal';
  }
}

class HorizontalLineAxisView implements ISeriesPrimitiveAxisView {
  private _data: HorizontalLineData | null = null;
  private _source: HorizontalLineDrawingTool;

  constructor(source: HorizontalLineDrawingTool) {
    this._source = source;
  }

  update(data: HorizontalLineData | null): void {
    this._data = data;
  }

  coordinate(): number {
    if (!this._data) return 0;
    return this._source.series.priceToCoordinate(this._data.price) ?? 0;
  }

  text(): string {
    if (!this._data) return '';
    return this._data.price.toFixed(2);
  }

  textColor(): string {
    return this._data?.color ?? '#ffffff';
  }

  backColor(): string {
    return this._data?.color ?? '#2196F3';
  }

  visible(): boolean {
    return this._data !== null;
  }
}

export class HorizontalLineDrawingTool implements ISeriesPrimitive<any> {
  private _paneView: HorizontalLinePaneView;
  private _axisView: HorizontalLineAxisView;
  private _data: HorizontalLineData | null = null;
  private _requestUpdate?: () => void;
  public chart: any;
  public series: any;

  constructor() {
    this._paneView = new HorizontalLinePaneView(this);
    this._axisView = new HorizontalLineAxisView(this);
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
    this._axisView.update(this._data);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return [this._axisView];
  }

  // Public methods to control the horizontal line
  setData(data: HorizontalLineData | null): void {
    this._data = data;
    this.updateAllViews();
    this._requestUpdate?.();
  }

  getData(): HorizontalLineData | null {
    return this._data;
  }
}

export { HorizontalLineData };