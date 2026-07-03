const { chromium } = require('playwright');
const fs = require('fs');

// Payload Data Extract karna
const payload = process.env.PAYLOAD_DATA ? JSON.parse(process.env.PAYLOAD_DATA) : null;
if (!payload) {
    console.error("[CRITICAL] n8n payload not found!");
    process.exit(1);
}

// Cookies injection utility function (Safe mode)
async function loadCookies(context, filePath) {
    if (fs.existsSync(filePath)) {
        let cookies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        // Playwright ki strict requirements ke liye sameSite sanitize karna
        cookies = cookies.map(cookie => {
            if (cookie.sameSite) {
                let formatted = cookie.sameSite.charAt(0).toUpperCase() + cookie.sameSite.slice(1).toLowerCase();
                if (!['Strict', 'Lax', 'None'].includes(formatted)) {
                    formatted = 'Lax'; 
                }
                cookie.sameSite = formatted;
            } else {
                cookie.sameSite = 'Lax'; // Default fallback agar missing ho
            }
            return cookie;
        });

        // Agar cookies inject karne me phir bhi issue aaye toh crash na karein
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

// 1. PINTEREST ENGINE
async function postToPinterest(browser, data) {
    console.log(`[PINTEREST] Initializing upload...`);
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        const cookiesLoaded = await loadCookies(context, 'pinterest_cookies.json');
        if (!cookiesLoaded) {
            console.log("[PINTEREST SKIPPED] Due to cookie injection failure.");
            await context.close();
            return;
        }

        await page.goto('https://www.pinterest.com/pin-creation-tool/', { waitUntil: 'networkidle' });
        
        // Check if logged in
        if (await page.url().includes('login')) {
            console.log("[PINTEREST ERR] Cookies expired or invalid! Skipping...");
            await context.close();
            return;
        }
        console.log("[PINTEREST] Logged in successfully via session storage.");
        // Baki upload workflows...
    } catch (err) { 
        console.error("[PINTEREST ERROR]", err.message); 
    }
    await context.close();
}

// 2. META/FACEBOOK PAGE ENGINE
async function postToFacebook(browser, data) {
    console.log(`[FACEBOOK] Initializing Page Creator Studio...`);
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        const cookiesLoaded = await loadCookies(context, 'facebook_cookies.json');
        if (!cookiesLoaded) {
            console.log("[FACEBOOK SKIPPED] Due to cookie injection failure.");
            await context.close();
            return;
        }

        await page.goto('https://business.facebook.com/latest/composer', { waitUntil: 'networkidle' });
        console.log("[FACEBOOK] Landed on Meta Business Composer.");
        // Baki upload workflows...
    } catch (err) { 
        console.error("[FACEBOOK ERROR]", err.message); 
    }
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
        if (!cookiesLoaded) {
            console.log("[INSTAGRAM SKIPPED] Due to cookie injection failure.");
            await context.close();
            return;
        }

        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
        console.log("[INSTAGRAM] Session activated on mobile layout.");
        // Baki upload workflows...
    } catch (err) { 
        console.error("[INSTAGRAM ERROR]", err.message); 
    }
    await context.close();
}

// 4. TIKTOK ENGINE
async function postToTikTok(browser, data) {
    console.log(`[TIKTOK] Initializing TikTok Upload Portal...`);
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        const cookiesLoaded = await loadCookies(context, 'tiktok_cookies.json');
        if (!cookiesLoaded) {
            console.log("[TIKTOK SKIPPED] Due to cookie injection failure.");
            await context.close();
            return;
        }

        await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'networkidle' });
        console.log("[TIKTOK] Landed on TikTok Creator Panel.");
    } catch (err) { 
        console.error("[TIKTOK ERROR]", err.message); 
    }
    await context.close();
}

// MASTER ENGINE INITIALIZATION
(async () => {
    console.log("[LAUNCH] Starting Headless Multi-Platform Engine Context...");
    const browser = await chromium.launch({ headless: true });

    // Individual try-catch taaki ek fail ho toh baki execute hon
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
