import { analyzeRegionLayout, describeLayout } from './src/lib/ai/region-analyzer';
import { generateCode } from './src/lib/ai/provider';
import fs from 'fs';

const regions = [
  // 1. Navbar (full width, top)
  { id: '1', regionNumber: 1, geometry: { type: 'rect', x: 0, y: 50, width: 1000, height: 50 }, lockState: {} },
  // 2. Hero Text (center, below navbar)
  { id: '2', regionNumber: 2, geometry: { type: 'rect', x: 200, y: 150, width: 600, height: 100 }, lockState: {} },
  // Freehand 1: Decorative underline under hero text
  { id: '3', regionNumber: 3, geometry: { type: 'freeform', x: 300, y: 250, width: 400, height: 20 }, isFloating: true, lockState: {} },
  // Arrow: Pointing from hero to dashboard
  { id: '4', regionNumber: 4, geometry: { type: 'arrow', x: 500, y: 280, width: 50, height: 50, path: [{x:0, y:0}, {x:0, y:1}] }, isFloating: true, lockState: {} },
  // 3. Dashboard Image (wide, below hero)
  { id: '5', regionNumber: 5, geometry: { type: 'rect', x: 100, y: 350, width: 800, height: 250 }, lockState: {} },
  // Freehand 2: Wavy divider between dashboard and feature cards
  { id: '6', regionNumber: 6, geometry: { type: 'freeform', x: 0, y: 650, width: 1000, height: 50 }, lockState: {} },
  // 4,5,6. Three Feature Cards (side by side)
  { id: '7', regionNumber: 7, geometry: { type: 'rect', x: 100, y: 750, width: 200, height: 150 }, lockState: {} },
  { id: '8', regionNumber: 8, geometry: { type: 'rect', x: 400, y: 750, width: 200, height: 150 }, lockState: {} },
  { id: '9', regionNumber: 9, geometry: { type: 'rect', x: 700, y: 750, width: 200, height: 150 }, lockState: {} },
  // 7. CTA / Footer (full width, bottom)
  { id: '10', regionNumber: 10, geometry: { type: 'rect', x: 0, y: 950, width: 1000, height: 50 }, lockState: {} },
] as any;

const prompt = "Create a modern SaaS landing page. The top section is a navbar with a logo. The hero section has a bold headline 'Write Faster' with a decorative underline. Below the headline is a large product dashboard mockup. An arrow points from the headline to the dashboard. Below the dashboard is a wavy section divider. Under the divider are 3 feature cards side-by-side with icons. The bottom section is a CTA banner.";

async function run() {
  console.log("=== SKELETON OUTPUT ===");
  const skeleton = describeLayout(regions);
  console.log(skeleton);
  fs.writeFileSync('skeleton.txt', skeleton);

  console.log("\n=== GENERATING CODE ===");
  const result = await generateCode(regions, prompt, undefined, 'gemini');
  
  if (result.success) {
    fs.writeFileSync('output.tsx', result.code);
    console.log("Code generated and saved to output.tsx!");
  } else {
    console.error("Failed to generate:", result.error);
  }
}

run();
