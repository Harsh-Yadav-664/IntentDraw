import { analyzeRegionLayout, describeLayout } from './src/lib/ai/region-analyzer';

const regions = [
  { id: '1', regionNumber: 1, geometry: { type: 'rect', x: 0, y: 50, width: 1000, height: 50 }, lockState: {} },
  { id: '2', regionNumber: 2, geometry: { type: 'rect', x: 200, y: 150, width: 600, height: 100 }, lockState: {} },
  { id: '3', regionNumber: 3, geometry: { type: 'freeform', x: 300, y: 250, width: 400, height: 20 }, isFloating: true, lockState: {} },
  { id: '4', regionNumber: 4, geometry: { type: 'arrow', x: 500, y: 280, width: 50, height: 50, path: [{x:0, y:0}, {x:0, y:1}] }, isFloating: true, lockState: {} },
  { id: '5', regionNumber: 5, geometry: { type: 'rect', x: 100, y: 350, width: 800, height: 250 }, lockState: {} },
  { id: '6', regionNumber: 6, geometry: { type: 'freeform', x: 0, y: 650, width: 1000, height: 50 }, lockState: {} },
  { id: '7', regionNumber: 7, geometry: { type: 'rect', x: 100, y: 750, width: 200, height: 150 }, lockState: {} },
  { id: '8', regionNumber: 8, geometry: { type: 'rect', x: 400, y: 750, width: 200, height: 150 }, lockState: {} },
  { id: '9', regionNumber: 9, geometry: { type: 'rect', x: 700, y: 750, width: 200, height: 150 }, lockState: {} },
  { id: '10', regionNumber: 10, geometry: { type: 'rect', x: 0, y: 950, width: 1000, height: 50 }, lockState: {} },
] as any;

console.log(describeLayout(regions));
