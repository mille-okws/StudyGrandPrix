const {spawnSync} = require('node:child_process');
const path = require('node:path');
const suites = ['subjects.cjs','astonmartin.cjs','layout.cjs','modes-championship.cjs','portuguese.cjs','themes.cjs','integration/data-safety.cjs','integration/legacy-regressions.cjs'];
for (const suite of suites) {
    console.log(`\nExecutando ${suite}`);
    const result = spawnSync(process.execPath, [path.join(__dirname,suite)], {stdio:'inherit',env:process.env});
    if (result.error) {console.error(result.error);process.exit(1)}
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log('\nTodas as 8 suítes passaram.');
