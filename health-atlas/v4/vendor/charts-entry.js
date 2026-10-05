import * as echarts from 'echarts/core';
import {ScatterChart,LineChart,HeatmapChart,BarChart} from 'echarts/charts';
import {TooltipComponent,GridComponent,LegendComponent,DataZoomComponent,VisualMapComponent,AriaComponent,MarkLineComponent,MarkPointComponent,BrushComponent} from 'echarts/components';
import {CanvasRenderer,SVGRenderer} from 'echarts/renderers';
echarts.use([ScatterChart,LineChart,HeatmapChart,BarChart,TooltipComponent,GridComponent,LegendComponent,DataZoomComponent,VisualMapComponent,AriaComponent,MarkLineComponent,MarkPointComponent,BrushComponent,CanvasRenderer,SVGRenderer]);
export {echarts};
