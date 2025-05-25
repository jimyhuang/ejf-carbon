const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const csvWriter = require('csv-writer');

async function processCarbonData(filePath, companyName, companyId, stockId, stockName, year) {
    return new Promise((resolve, reject) => {
        const carbonData = [];
        const carbonRows = [];
        
        fs.createReadStream(filePath, { encoding: 'utf8' })
            .pipe(csv({ headers: false }))
            .on('data', (row) => {
                const rowArray = Object.values(row);
                
                const rowText = rowArray.join(' ');
                if (rowText.includes('(範疇一)') || 
                    rowText.includes('(範疇二)') || 
                    rowText.includes('(範疇三)')) {
                    
                    const newRow = {
                        companyName: companyName,
                        companyId: companyId,
                        stockId: stockId,
                        stockName: stockName,
                        year: year,
                        column1: rowArray[0] || '',
                        column2: rowArray[1] || '',
                        column3: rowArray[2] || '',
                        column4: rowArray[3] || '',
                        column5: rowArray[4] || '',
                        column6: rowArray[5] || '',
                        column7: rowArray[6] || '',
                        column8: rowArray[7] || ''
                    };
                    carbonRows.push(newRow);
                }
            })
            .on('end', () => {
                resolve(carbonRows);
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

async function saveCarbonData(carbonRows) {
    const carbonFilePath = path.join(process.cwd(), 'download', `all-carbon.csv`);
    const fileExists = fs.existsSync(carbonFilePath);
    
    const writer = csvWriter.createObjectCsvWriter({
        path: carbonFilePath,
        header: [
            { id: 'companyName', title: '公司名稱' },
            { id: 'companyId', title: '統一編號' },
            { id: 'stockId', title: '股票代號' },
            { id: 'stockName', title: '股票名稱' },
            { id: 'year', title: '年度' },
            { id: 'column1', title: '類型' },
            { id: 'column2', title: '議題' },
            { id: 'column3', title: '指標' },
            { id: 'column4', title: '數據' },
            { id: 'column5', title: '資料邊界' },
            { id: 'column6', title: '確信機構	' },
            { id: 'column7', title: '確信標準' },
            { id: 'column8', title: '確信範圍' }
        ],
        append: fileExists
    });
    
    await writer.writeRecords(carbonRows);
    
    console.log(`碳排放資料已儲存至: ${carbonFilePath}`);
    console.log(`新增了 ${carbonRows.length} 筆範疇資料`);
}

async function findCompanyInfo(companyName) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(process.cwd(), 'download', 'all-carbon.csv');

        // 檢查檔案是否存在
        if (!fs.existsSync(filePath)) {
            reject(new Error('all-carbon.csv 檔案不存在'));
            return;
        }

        let found = false;

        fs.createReadStream(filePath, { encoding: 'utf8' })
            .pipe(csv({
                mapHeaders: ({ header, index }) => {
                    const mapping = {
                        0: 'companyName',
                        1: 'companyId',
                        2: 'stockId',
                        3: 'stockName'
                    };
                    return mapping[index] || header;
                }
            }))
            .on('data', (row) => {
                if (row.companyName === companyName) {
                    const rowValues = Object.values(row);
                    const result = {
                        companyId: row.companyId || '',
                        stockId: row.stockId || '',
                        stockName: row.stockName || ''
                    };
                    found = true;
                    resolve(result);
                }
            })
            .on('end', () => {
                if (!found) {
                    resolve(null); // 沒找到匹配的公司名稱
                }
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}

async function automateESGSearch(companyQuery, year) {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    let companyId = '',
      stockId = '',
      stockName = '';
    const result = await findCompanyInfo(companyQuery);
    if (result) {
      if (typeof result.companyId !== 'undefined') companyId = result.companyId;
      if (typeof result.stockId !== 'undefined') stockId = result.stockId;
      if (typeof result.stockName !== 'undefined') stockName = result.stockName;
    }

    // Setting default timeouts. Consider increasing these if network is slow or pages are complex.
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);

    if (!stockId) {
      try {
        console.log(`開始查詢 ${companyQuery} 的公司基本資料...`);

        const url = 'https://company.g0v.ronny.tw/api/search?page=1&q='+companyQuery;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const jsonData = await response.json();
        if (jsonData.data && jsonData.data.length > 0) {
            companyId = jsonData.data[0]["統一編號"];
            console.log('統一編號:', companyId);
        } else {
            console.log('沒有找到統一編號資料');
        }

        console.log(`開始查詢 ${companyQuery} 的股票代號資訊...`);
        const isinUrl = `https://isin.twse.com.tw/isin/single_main.jsp?owncode=&stockname=${encodeURIComponent(companyQuery)}`;
        await page.goto(isinUrl);
        await page.waitForLoadState('networkidle');

        const noDataLocator = page.locator("td.h1:has-text('查無資料!')");
        if (await noDataLocator.count() > 0 && await noDataLocator.isVisible()) {
            throw new Error(`在 ISIN 網站上找不到關於 "${companyQuery}" 的資料。`);
        }

        const tableLocator = page.locator('table.h4');
        await tableLocator.waitFor({ state: 'visible', timeout: 10000 }); // Wait for table

        // Get the second row of the table (first data row)
        const dataRowLocator = tableLocator.locator('tr').nth(1);
        await dataRowLocator.waitFor({ state: 'attached', timeout: 5000 });

        // Extract stockId from the 3rd column and stockName from the 4th column as per request
        const stockIdCellLocator = dataRowLocator.locator('td').nth(2); // 3rd column
        const stockNameCellLocator = dataRowLocator.locator('td').nth(3); // 4th column

        stockId = (await stockIdCellLocator.textContent() || '').trim();
        stockName = (await stockNameCellLocator.textContent() || '').trim();

        if (!stockId) {
            console.warn(`警告: 從 ISIN 網站獲取的 stockId (第三欄) 為空。companyQuery: ${companyQuery}`);
            // Decide if this is a fatal error or if we should proceed with companyQuery
        }

        console.log(`從 ISIN 網站獲取到的資訊:`);
        console.log(`  - stockId (來自第三欄): ${stockId}`);
        console.log(`  - stockName (來自第四欄): ${stockName}`);
        // Note: stockId (e.g., "台積電") will be used as the company identifier for ESG site.

      } catch (error) {
          console.error('執行過程中發生錯誤:', error);
      }
    }

    const fileName = `${companyId}-${year}.csv`; // Filename uses companyId
    const filePath = path.join(process.cwd(), 'download', fileName);
    const fileExists = fs.existsSync(filePath);

    if (!fileExists) {
      try {
        const downloadDir = path.join(process.cwd(), 'download');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        await page.goto('https://esggenplus.twse.com.tw/inquiry/info/individual');
        
        await page.waitForLoadState('networkidle');

        await page.click('.left-box input[placeholder="公司代號/股票代號*"]');
        await page.waitForTimeout(2000);

        // Using stockId (from 3rd column of ISIN) for the ESG site's company code field
        await page.fill('.left-box input[placeholder="公司代號/股票代號*"]', stockId.toString());
        await page.waitForSelector('.dropdown-box .option-box .option-item', { timeout: 7000 });
        await page.click('.dropdown-box .option-box .option-item:first-child');

        await page.click('.left-box input[placeholder="報告年度*"]');
        await page.waitForTimeout(2000);
        
        await page.fill('.left-box input[placeholder="報告年度*"]', year.toString());
        
        await page.waitForSelector('.dropdown-box .option-box .option-item', { timeout: 7000 });
        await page.click('.dropdown-box .option-box .option-item:first-child');

        await page.click('.left-box button.default');
        
        await page.waitForTimeout(3000);
        
        const downloadPromise = page.waitForEvent('download');
        
        const csvButton = await page.locator('.tool-item-box .text').filter({ hasText: '另存CSV' });
        await csvButton.click();
        
        const download = await downloadPromise;
        
        const downloadPath = path.join(process.cwd(), 'download', fileName);
        
        await download.saveAs(downloadPath);
        
        console.log(`檔案已成功下載並儲存至: ${downloadPath}`);
        
      } catch (error) {
          console.error('執行過程中發生錯誤:', error);
      }
    }

    console.log('開始處理碳排放資料...');
    const carbonRows = await processCarbonData(filePath, companyQuery, companyId, stockId, stockName, year);
        
    if (carbonRows.length > 0) {
      await saveCarbonData(carbonRows);
    } else {
      console.log('未找到範疇相關資料');
    }
        
    await browser.close();
    console.log('自動化流程完成！');
        
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) { // companyQuery can be company name or code for ISIN search
        console.log('使用方式: node grab.js "<公司全名>" <年度>');
        console.log('範例 (使用公司名稱): node grab.js "台灣積體電路製造股份有限公司" 2023');
        process.exit(1);
    }
    
    const companyQuery = args[0]; // This will be used for ISIN search
    const year = args[1];
    console.log(`開始處理查詢: ${companyQuery}, 年度: ${year}`);
    await automateESGSearch(companyQuery, year);
}

main().catch(console.error);

module.exports = { automateESGSearch, processCarbonData, saveCarbonData, findCompanyInfo };
