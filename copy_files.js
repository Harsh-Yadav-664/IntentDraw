const fs = require('fs');
const path = require('path');
const files = {
  'output_login_card.tsx': 'src/app/test-login/page.tsx',
  'output_saas_landing.tsx': 'src/app/test-saas/page.tsx',
  'output_portfolio.tsx': 'src/app/test-portfolio/page.tsx',
  'output_saas_playful.tsx': 'src/app/test-saas-playful/page.tsx',
  'output_saas_minimal.tsx': 'src/app/test-saas-minimal/page.tsx'
};
for (const [src, dest] of Object.entries(files)) {
  const srcPath = path.join(process.cwd(), src);
  const destPath = path.join(process.cwd(), dest);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  let content = fs.readFileSync(srcPath, 'utf8');
  if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) {
    content = '"use client";\n' + content;
  }
  fs.writeFileSync(destPath, content, 'utf8');
}
console.log('Files copied successfully.');
