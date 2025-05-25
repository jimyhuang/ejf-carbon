const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const csvWriter = require('csv-writer');

async function processCarbonData(filePath, company, year) {
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
                        company: company,
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

async function saveCarbonData(carbonRows, company) {
    const carbonFilePath = path.join(process.cwd(), 'download', `all-carbon.csv`);
    const fileExists = fs.existsSync(carbonFilePath);
    
    const writer = csvWriter.createObjectCsvWriter({
        path: carbonFilePath,
        header: [
            { id: 'company', title: '公司' },
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

async function automateESGSearch(company, year) {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(5000);

    try {
        const downloadDir = path.join(process.cwd(), 'download');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        await page.goto('https://esggenplus.twse.com.tw/inquiry/info/individual');
        
        await page.waitForLoadState('networkidle');

        await page.click('.left-box input[placeholder="公司代號/股票代號*"]');
        await page.waitForTimeout(2000);
        
        await page.fill('.left-box input[placeholder="公司代號/股票代號*"]', company.toString());
        
        await page.waitForSelector('.dropdown-box .option-box .option-item');
        await page.click('.dropdown-box .option-box .option-item:first-child');

        await page.click('.left-box input[placeholder="報告年度*"]');
        await page.waitForTimeout(2000);
        
        await page.fill('.left-box input[placeholder="報告年度*"]', year.toString());
        
        await page.waitForSelector('.dropdown-box .option-box .option-item');
        await page.click('.dropdown-box .option-box .option-item:first-child');

        await page.click('.left-box button.default');
        
        await page.waitForTimeout(3000);
        
        const downloadPromise = page.waitForEvent('download');
        
        const csvButton = await page.locator('.tool-item-box .text').filter({ hasText: '另存CSV' });
        await csvButton.click();
        
        const download = await downloadPromise;
        
        const fileName = `${company}-${year}.csv`;
        const downloadPath = path.join(process.cwd(), 'download', fileName);
        
        await download.saveAs(downloadPath);
        
        console.log(`檔案已成功下載並儲存至: ${downloadPath}`);
        
        console.log('開始處理碳排放資料...');
        const carbonRows = await processCarbonData(downloadPath, company, year);
        
        if (carbonRows.length > 0) {
            await saveCarbonData(carbonRows, company);
        } else {
            console.log('未找到範疇相關資料');
        }
        
        console.log('自動化流程完成！');
        
    } catch (error) {
        console.error('執行過程中發生錯誤:', error);
    } finally {
        await browser.close();
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('使用方式: node script.js <company> <year>');
        console.log('範例: node script.js 2330 2023');
        process.exit(1);
    }
    
    const company = args[0];
    const year = args[1];
    
    console.log(`開始處理公司: ${company}, 年度: ${year}`);
    
    await automateESGSearch(company, year);
}

main().catch(console.error);

module.exports = { automateESGSearch, processCarbonData, saveCarbonData };
