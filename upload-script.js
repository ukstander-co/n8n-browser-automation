const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Payload Data Extract karna
const payload = process.env.PAYLOAD_DATA ? JSON.parse(process.env.PAYLOAD_DATA) : null;
if (!payload) {
    console.error("[CRITICAL] n8n payload not found!");
    process.exit(1);
}

// Utility function to download image from URL to local disk for file uploading
function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); 
            reject(err);
        });
    });
}

// Cookies injection utility function (Safe mode)
async function loadCookies(context, filePath) {
    if (fs.existsSync(filePath)) {
        let cookies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        cookies = cookies.map(cookie => {
            if (cookie.sameSite) {
                let formatted = cookie.sameSite.charAt(0).toUpperCase() + cookie.sameSite.slice(1).toLowerCase();
                if (!['Strict', 'Lax', 'None'].includes(formatted)) {
                    formatted = 'Lax'; 
                }
                cookie.sameSite = formatted;
            } else {
                cookie.sameSite = 'Lax';
            }
            return cookie;
        });

        try {
            await context.addCookies(cookies);
            console.log(`[COOKIES] Successfully injected cookies from ${filePath}`);
            return true;
        } catch (cookieErr) {
            console.error(`[COOKIES ERROR] Failed to inject cookies for ${filePath}:`, cookieErr.message);
            return false;
        }
    } else {
        console.log(`[WARN] Cookies file not found: ${filePath}`);
        return false;
    }
}

// 1. PINTEREST ENGINE (FULLY AUTOMATED WITH SLOWMO FOR VISIBILITY)
async function postToPinterest(browser, data) {
    console.log(`[PINTEREST] Initializing upload workflow...`);
    const context = await browser.newContext();
    const page = await context.newPage();
    const tempImagePath = path.join(__dirname, 'temp_pinterest.jpg');
    
    try {
        const cookiesLoaded = await loadCookies(context, 'pinterest_cookies.json');
        if (!cookiesLoaded) {
            console.log("[PINTEREST SKIPPED] Due to cookie injection failure.");
            await context.close();
            return;
        }

        // Navigate to the creation tool
        await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000); // Visual stability cushion
        
        // Session validation check
        if (await page.url().includes('login')) {
            console.log("[PINTEREST ERR] Cookies expired or invalid! Skipping...");
            await context.close();
            return;
        }
        console.log("[PINTEREST] Logged in successfully via session storage.");

        // Image link parsing and local downloading
        if (data.image) {
            console.log(`[PINTEREST] Downloading media asset from: ${data.image}`);
            await downloadImage(data.image, tempImagePath);
            
            // Wait for file upload input to be ready
            await page.waitForSelector('input[type="file"]', { timeout: 15000 });
            const fileInput = await page.$('input[type="file"]');
            await fileInput.setInputFiles(tempImagePath);
            console.log("[PINTEREST] Visual media payload successfully attached.");
            await page.waitForTimeout(2000);
        }

        // Title injection
        if (data.title) {
            const titleSelector = 'input[id="storyboard-selector-title"], input[placeholder*="title"], [title="Add your title"]';
            await page.waitForSelector(titleSelector, { timeout: 10000 });
            await page.fill(titleSelector, data.title);
            console.log("[PINTEREST] Meta Title configured.");
        }

        // Description/Caption injection
        if (data.description || data.caption) {
            const descText = data.description || data.caption;
            const descSelector = 'div[role="textbox"][id*="description"], textarea[placeholder*="tell everyone"], [title="Tell everyone what your Pin is about"]';
            await page.waitForSelector(descSelector, { timeout: 10000 });
            await page.fill(descSelector, descText);
            console.log("[PINTEREST] Context Description injected.");
        }

        // Destination Link injection
        if (data.link) {
            const linkSelector = 'input[id="storyboard-selector-link"], input[placeholder*="link"], [title="Add a destination link"]';
            await page.waitForSelector(linkSelector, { timeout: 10000 });
            await page.fill(linkSelector, data.link);
            console.log("[PINTEREST] Destination Anchor Link mapped.");
        }

        // Finalize Workflow: Publishing execution
        console.log("[PINTEREST] Locating standard publication targets...");
        const publishButtonSelector = 'button[type="button"] :text-matches("Publish", "i"), button:has-text("Publish")';
        await page.waitForSelector(publishButtonSelector, { timeout: 10000 });
        
        await page.click(publishButtonSelector);
        await page.waitForTimeout(5000); // Wait to watch the transition live
        
        console.log("[PINTEREST SUCCESS] Pin content successfully compiled and broadcasted.");

    } catch (err) { 
        console.error("[PINTEREST CRITICAL ERROR]", err.message); 
    } finally {
        if (fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
        }
        await context.close();
    }
}

// 2. META/FACEBOOK PAGE ENGINE
async function postToFacebook(browser, data) {
    console.log(`[FACEBOOK] Initializing Page Creator Studio...`);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        const cookiesLoaded = await loadCookies(context, 'facebook_cookies.json');
        if (!cookiesLoaded) return;
        await page.goto('https://business.facebook.com/latest/composer', { waitUntil: 'networkidle' });
        console.log("[FACEBOOK] Landed on Meta Business Composer.");
        await page.waitForTimeout(4000);
    } catch (err) { console.error("[FACEBOOK ERROR]", err.message); }
    await context.close();
}

// 3. INSTAGRAM ENGINE
async function postToInstagram(browser, data) {
    console.log(`[INSTAGRAM] Initializing Creator Panel...`);
    const context = await browser.newContext({
        viewport: { width: 375, height: 812 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    try {
        const cookiesLoaded = await loadCookies(context, 'instagram_cookies.json');
        if (!cookiesLoaded) return;
        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
        console.log("[INSTAGRAM] Session activated on mobile layout.");
        await page.waitForTimeout(4000);
    } catch (err) { console.error("[INSTAGRAM ERROR]", err.message); }
    await context.close();
}

// 4. TIKTOK ENGINE
async function postToTikTok(browser, data) {
    console.log(`[TIKTOK] Initializing TikTok Upload Portal...`);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        const cookiesLoaded = await loadCookies(context, 'tiktok_cookies.json');
        if (!cookiesLoaded) return;
        await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'networkidle' });
        console.log("[TIKTOK] Landed on TikTok Creator Panel.");
        await page.waitForTimeout(4000);
    } catch (err) { console.error("[TIKTOK ERROR]", err.message); }
    await context.close();
}

// MASTER ENGINE INITIALIZATION
(async () => {
    console.log("[LAUNCH] Starting GUI Graphical Context Mode...");
    // Headless false and slowMo added so actions can be seen clearly on screen stream
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 100 
    });

    if (payload.pinterest) {
        try { await postToPinterest(browser, payload.pinterest); } catch(e) { console.error("Pinterest wrapper crashed", e); }
    }
    if (payload.facebook) {
        try { await postToFacebook(browser, payload.facebook); } catch(e) { console.error("Facebook wrapper crashed", e); }
    }
    if (payload.instagram) {
        try { await postToInstagram(browser, payload.instagram); } catch(e) { console.error("Instagram wrapper crashed", e); }
    }
    if (payload.tiktok) {
        try { await postToTikTok(browser, payload.tiktok); } catch(e) { console.error("TikTok wrapper crashed", e); }
    }

    await browser.close();
    console.log("[SUCCESS] All cloud automated processes finished.");
})();
