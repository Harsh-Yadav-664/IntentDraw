import { generateCode } from './src/lib/ai/provider';
import { resolveDesignTokens } from './src/lib/ai/design-tokens';
import fs from 'fs';

const PROMPTS = [
  {
    name: 'login_card',
    prompt: 'Create a sleek, modern login card. It should have a clean email and password input, and a bold submit button. Make it look very premium and sharp.',
  },
  {
    name: 'saas_landing',
    prompt: 'A modern SaaS landing page. The hero section has a bold headline "Write Faster" with a large product dashboard mockup below it. Below the dashboard are 3 feature cards side-by-side with icons. The bottom section is a CTA banner.',
  },
  {
    name: 'portfolio',
    prompt: 'A sophisticated photography portfolio section. It should look like a high-end editorial magazine, featuring elegant typography and subtle design touches. Show a grid of images.',
  },
  {
    name: 'saas_playful',
    prompt: 'A modern SaaS landing page. The hero section has a bold headline "Write Faster" with a large product dashboard mockup below it. Below the dashboard are 3 feature cards side-by-side with icons. The bottom section is a CTA banner. Make it extremely playful and fun.',
  },
  {
    name: 'saas_minimal',
    prompt: 'A modern SaaS landing page. The hero section has a bold headline "Write Faster" with a large product dashboard mockup below it. Below the dashboard are 3 feature cards side-by-side with icons. The bottom section is a CTA banner. Use a minimal and clean style.',
  }
];

async function run() {
  for (const p of PROMPTS) {
    console.log(`\n=== GENERATING: ${p.name} ===`);
    
    // Log the resolved tokens so we can see which preset was picked
    const tokens = await resolveDesignTokens(p.prompt);
    console.log(`Resolved Preset: ${tokens.name}`);
    
    const result = await generateCode([], p.prompt, undefined, 'gemini');
    
    if (result.success) {
      const filename = `output_${p.name}.tsx`;
      fs.writeFileSync(filename, result.code!);
      console.log(`Code generated and saved to ${filename}!`);
    } else {
      console.error(`Failed to generate ${p.name}:`, result.error);
    }
  }
}

run();
