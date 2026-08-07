const fs = require('fs');
const d = JSON.parse(fs.readFileSync('../checkpoints/lint-bulk-cleanup-start.json', 'utf8'));
for (const f of d) {
  const msgs = f.messages.filter((m) => m.severity === 2);
  if (msgs.length === 0) continue;
  const rel = f.filePath.replace(process.cwd() + '/', '');
  console.log('\n## ' + rel);
  for (const m of msgs) {
    console.log(`${m.line}:${m.column} ${m.ruleId} ${m.message}`);
  }
}
