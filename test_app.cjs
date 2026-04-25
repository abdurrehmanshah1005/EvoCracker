const puppeteer = require('puppeteer-core');

(async () => {
  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: "new"
    });
    const page = await browser.newPage();

    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
      console.log(`[BROWSER ERROR] ${err.message}`);
    });

    await page.goto('http://localhost:5173/');
    console.log("Navigated to game...");

    await new Promise(r => setTimeout(r, 1000));

    console.log("Clicking Trial Mode...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Trial Mode'));
      if(btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 500));
    
    console.log("Clicking Choose Champion...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Choose Champion'));
      if(btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 500));

    console.log("Clicking Enter the Dungeon...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Enter the Dungeon'));
      if(btn) btn.click();
    });

    await new Promise(r => setTimeout(r, 10000)); // wait 10 seconds instead of 2

    await browser.close();
  } catch (err) {
    console.error("Script failed: ", err);
  }
})();
