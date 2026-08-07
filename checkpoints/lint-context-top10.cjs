const fs=require('fs');
const data=JSON.parse(fs.readFileSync('../checkpoints/lint-bulk-cleanup-start.json','utf8'));
const targets=new Set([
'src/components/DealIntelligence.jsx',
'src/components/AppraiserPacketBuilder.jsx',
'src/components/PropertyDatabase.jsx',
'src/components/VendorDatabase.jsx',
'src/components/intelligenceUpgradeEngine.js',
'src/components/RehabProjectTracker.jsx',
'src/components/refinanceExitOptimizer.js',
'src/components/LenderDashboard.jsx',
'src/components/executiveStrategyOptimizationEngine.js',
'src/components/portfolioIntelligence.js'
]);
for (const f of data) {
  const rel = f.filePath.replace(process.cwd() + '/', '');
  if (targets.has(rel) === false) continue;
  const lines = fs.readFileSync(rel, 'utf8').split('\n');
  console.log('\n### ' + rel);
  for (const m of f.messages.filter((msg) => msg.severity === 2)) {
    const start = Math.max(1, m.line - 2);
    const end = Math.min(lines.length, m.line + 2);
    console.log(`\n-- ${m.line}:${m.column} ${m.ruleId} ${m.message}`);
    for (let i = start; i <= end; i += 1) {
      console.log(String(i).padStart(5) + ': ' + lines[i - 1]);
    }
  }
}
