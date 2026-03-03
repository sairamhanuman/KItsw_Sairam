const puppeteer = require('puppeteer');

async function testRegulationsPage() {
  console.log('🔍 Testing Regulations Page Directly...');
  
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('📋 Navigating to regulations page...');
    await page.goto('http://localhost:3000/internal-exam/create-notification.html');
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    console.log('🔍 Checking if regulations dropdown is populated...');
    
    // Check if regulations dropdown has options
    const regulationsCount = await page.evaluate(() => {
      const regulationSelect = document.getElementById('regulations');
      if (!regulationSelect) return 0;
      return regulationSelect.options.length;
    });
    
    console.log(`📊 Regulations dropdown options count: ${regulationsCount}`);
    
    if (regulationsCount > 0) {
      console.log('✅ Regulations dropdown IS populated');
      
      // Get the actual options
      const options = await page.evaluate(() => {
        const regulationSelect = document.getElementById('regulations');
        if (!regulationSelect) return [];
        
        return Array.from(regulationSelect.options).map(option => ({
          value: option.value,
          text: option.textContent
        }));
      });
      
      console.log('📋 Regulations options:');
      options.forEach((option, index) => {
        console.log(`  ${index + 1}. ${option.text} (value: ${option.value})`);
      });
      
    } else {
      console.log('❌ Regulations dropdown is EMPTY');
    }
    
    // Check console for debug messages
    console.log('🔍 Checking browser console...');
    const consoleMessages = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.log;
      
      console.log = function(...args) {
        logs.push(args.join(' '));
        originalLog.apply(console, args);
      };
      
      // Wait a bit for any debug messages
      setTimeout(() => {
        console.log = originalLog;
      }, 2000);
      
      return logs;
    });
    
    console.log('📋 Console messages:');
    consoleMessages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg}`);
    });
    
  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await browser.close();
  }
}

testRegulationsPage();
