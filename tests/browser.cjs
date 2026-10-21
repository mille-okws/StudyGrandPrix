const { chromium } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
module.exports.launch = () => chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
module.exports.screenshot = name => {
    const directory = process.env.TEST_ARTIFACT_DIR || path.join(os.tmpdir(), 'study-grand-prix-tests');
    fs.mkdirSync(directory, { recursive: true });
    return path.join(directory, name);
};
module.exports.ready = page => page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
module.exports.snapshot = page => page.evaluate(async () => (await (await import('/js/infrastructure/repositories/studyRepository.js')).readSnapshot()).store);
// Clear only the isolated test context's database when installing legacy fixtures.
module.exports.clearDatabase = page => page.evaluate(async () => {
    await new Promise((resolve,reject) => {
        const r=indexedDB.open('study-grand-prix');
        r.onerror=()=>reject(r.error);
        r.onsuccess=()=>{const db=r.result;const tx=db.transaction([...db.objectStoreNames],'readwrite');
            for(const name of db.objectStoreNames)tx.objectStore(name).clear();
            tx.oncomplete=()=>{db.close();resolve()};tx.onabort=()=>reject(tx.error);};
    });
});
