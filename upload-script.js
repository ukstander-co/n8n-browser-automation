const { chromium } = require('playwright');

(async () => {
    // n8n se bheja gaya data input parameters ke zariye read karna
    const targetUrl = process.env.TARGET_URL || 'https://example.com';
    const postContent = process.env.POST_CONTENT || 'Default Post Data';

    console.log(`[START] Launching headless cloud browser...`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log(`[NAVIGATE] Going to target site: ${targetUrl}`);
        await page.goto(targetUrl);

        // --- YAHAN AAPKA SPECIFIC POST UPLOAD LOGIC AAYEGA ---
        // Example: Agar kisi input field me text dalna ho
        // await page.fill('textarea[name="post"]', postContent);
        // await page.click('button[type="submit"]');
        
        console.log(`[SUCCESS] Current Page Title: ${await page.title()}`);
        console.log(`[DATA RECEIVED FROM n8n]: ${postContent}`);

    } catch (error) {
        console.error(`[ERROR] Automation crashed:`, error);
        process.exit(1);
    } finally {
        await browser.close();
        console.log(`[END] Cloud browser closed successfully.`);
    }
})();
