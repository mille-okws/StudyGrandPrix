const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.clock.install();
        await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle' });
        assert.equal(await page.locator('html').getAttribute('lang'), 'pt-BR');
        assert.equal((await page.locator('.team-select-header h1').innerText()).trim(), 'ESCOLHA SUA EQUIPE');
        // Theme identities remain as named, while the surrounding UI is translated.
        const themes = {
            mercedes: 'SILVER ARROW', ferrari: 'ROSSO CORSA', redbull: 'BLUE BULL',
            mclaren: 'PAPAYA', astonmartin: 'AMR', alpine: 'PINK BWT'
        };
        assert.equal(await page.locator('.team-select-card__style').first().innerText(), 'ENGINEERING');
        for (const [team, title] of Object.entries(themes)) {
            if (team !== 'mercedes') await page.locator('#changeTeamBtn').click();
            await page.locator(`.team-select-card[data-team="${team}"]`).click();
            await page.waitForLoadState('networkidle');
            assert.equal(await page.locator('.brand-text .t1').innerText(), title);
            assert.equal(await page.locator('.brand-text .t2').innerText(), 'CONTROLE DE ESTUDOS');
            assert.match(await page.locator('#changeTeamBtn').innerText(), /^EQUIPE \/\//);
            assert.match(await page.locator('#projectFooter').innerText(), /ESTUDE\. ANALISE\. AVANCE\./);
            const text = await page.locator('body').innerText();
            assert.ok(!/FREE PRACTICE|QUALIFYING|CURRENT CIRCUIT|SESSION ROUTING|DRIVER CONDITION|POWER UNIT|STUDY TELEMETRY|BOX REQUIRED|\bPUSH\b|\bPACE\b/.test(text));
            const pseudo = await page.locator('.trackview').evaluate(el => getComputedStyle(el, '::before').content);
            assert.ok(!/LIVE|TRACK DATA|PERFORMANCE DATA/.test(pseudo));
        }
        await page.locator('#startBtn').click();
        assert.match(await page.locator('#engineerMsg').innerText(), /Selecione um circuito/);
        await page.locator('.circuit-row').first().click();
        assert.equal(await page.locator('#trackRd').innerText(), 'ETAPA 01');
        const modes = { practice: 'TREINO LIVRE', qualy: 'CLASSIFICAÇÃO', race: 'CORRIDA', short: 'PAUSA CURTA', long: 'PAUSA LONGA' };
        for (const [mode, label] of Object.entries(modes)) {
            await page.locator(`[data-mode="${mode}"]`).click();
            assert.equal(await page.locator('#sessionTypeLabel').innerText(), label);
            assert.equal(await page.locator('#topSession').innerText(), label);
            assert.match(await page.locator('#engineerMsg').innerText(), /Aperte INICIAR/);
        }
        await page.locator('[data-mode="short"]').click();
        await page.locator('#startBtn').click();
        assert.equal(await page.locator('#startBtn').innerText(), '[ PAUSAR ]');
        await page.clock.runFor(300000);
        assert.match(await page.locator('#engineerMsg').innerText(), /^Pausa concluída\. Energia recuperada:/);
        assert.equal(await page.locator('#startBtn').innerText(), '[ INICIAR ]');
        await page.locator('#resetBtn').click();
        assert.match(await page.locator('#resetBtn').innerText(), /REINICIAR/);
        await page.setViewportSize({ width: 320, height: 844 });
        await page.locator('#changeTeamBtn').click();
        await page.locator('.team-select-card[data-team="astonmartin"]').click();
        await page.waitForLoadState('networkidle');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(errors, []);
        console.log('PASSOU: interface em português, identidade dos seis temas preservada, textos CSS, cinco modos, mensagens de início e fim, controles e tela móvel.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
