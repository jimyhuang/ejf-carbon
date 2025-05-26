# ESG 碳排放資料抓取工具

## 簡介

本專案旨在自動化抓取台灣上市櫃公司在「公司治理中心 ESG永續報告平台 (TWSE ESG GenPlus)」上揭露的 ESG 報告書中的碳排放相關數據（範疇一、範疇二、範疇三）。程式會先查詢公司的基本資料（統一編號、股票代號），然後下載對應年度的 ESG 報告書 (CSV 格式)，最後從中提取所需的碳排放數據並彙整至統一的 CSV 檔案中。

主要技術：
*   Node.js
*   Playwright (用於網頁自動化操作與資料抓取)
*   Bash Script (用於批次處理)

## 功能

*   **自動查詢公司資訊**：
    *   若 `download/all-carbon.csv` 中已存在公司資料，則直接取用。
    *   否則，透過 g0v 公司資料 API 查詢公司統一編號。
    *   透過 臺灣證券交易所 ISIN 查詢服務 查詢公司股票代號與股票名稱。
*   **自動下載 ESG 報告**：
    *   使用 Playwright 自動操作「ESG永續報告平台」。
    *   根據提供的股票代號和年度，搜尋並下載對應的 ESG 報告書 (CSV 檔案)。
    *   下載的個別公司報告儲存於 `download/<統一編號>-<年度>.csv`。
*   **提取碳排放數據**：
    *   從下載的 CSV 報告中，篩選包含「(範疇一)」、「(範疇二)」或「(範疇三)」關鍵字的資料列。
*   **彙總數據**：
    *   將提取的碳排放數據（包含公司名稱、統一編號、股票代號、股票名稱、年度及各欄位數據）附加儲存到 `download/all-carbon.csv` 檔案中。
*   **批次處理**：
    *   `run.sh` 腳本支援讀取 `company.txt` 檔案，批次處理多個公司的資料抓取任務 (預設抓取 2023 及 2024 年度)。

## 安裝教學

### 1. 安裝 Node.js

本專案需要 Node.js 環境來執行 JavaScript 腳本。

*   前往 Node.js 官方網站下載適用於您作業系統的安裝程式。
*   建議安裝 LTS (Long Term Support) 版本。
*   安裝完成後，開啟終端機（命令提示字元、PowerShell、Git Bash 或 WSL 終端機，建議使用 Git Bash），執行以下指令，確認安裝成功：
    ```bash
    node -v
    npm -v
    ```
    您應該會看到 Node.js 和 npm (Node Package Manager) 的版本號。

### 2. 安裝本專案程式

*   首先，取得專案檔案 (例如透過 `git clone` 或下載 ZIP 檔案)。
*   開啟終端機，並切換到專案的根目錄。
*   執行以下指令安裝專案所需的依賴套件 (包含 Playwright, csv-parser, csv-writer)：
    ```bash
    npm install
    ```

### 3. 安裝 Playwright 瀏覽器驅動

Playwright 需要對應的瀏覽器驅動程式才能運作。

*   在專案根目錄下，執行以下指令來安裝預設的瀏覽器 (Chromium, Firefox, WebKit)：
    ```bash
    npx playwright install
    ```
    如果您只需要特定瀏覽器，可以指定，例如 `npx playwright install chromium`。

## 使用教學

### 1. 準備 `company.txt`

`run.sh` 腳本會讀取專案根目錄下的 `company.txt` 檔案來決定要處理哪些公司。

*   在專案根目錄下建立一個名為 `company.txt` 的純文字檔案。
*   檔案內容格式為：每行一個公司的**完整官方名稱**。此名稱將用於在 ISIN 網站上查詢股票代號。
    例如：
    ```
    台灣積體電路製造股份有限公司
    鴻海精密工業股份有限公司
    ```
*   請確保公司名稱的準確性，以便能成功查詢到股票代號。

### 2. 執行腳本

#### 在 Windows 環境執行 `run.sh`

`run.sh` 是一個 Bash 腳本，在 Windows 上直接執行 `.sh` 檔案通常不可行。建議使用以下任一方式：

*   **Git Bash (推薦)**：
    1.  如果您尚未安裝 Git for Windows，請至 Git 官方網站 下載並安裝。安裝過程中請確保選擇安裝 Git Bash。
    2.  安裝完成後，在專案的根目錄點擊滑鼠右鍵，選擇 "Git Bash Here"。
    3.  在開啟的 Git Bash 終端機中，執行以下指令：
        ```bash
        ./run.sh
        ```

*   **WSL (Windows Subsystem for Linux)**：
    1.  如果您已在 Windows 上設定 WSL 並安裝了任一 Linux 發行版 (如 Ubuntu)。
    2.  開啟 WSL 終端機，導航到專案目錄 (Windows 的磁碟通常掛載在 `/mnt/` 下，例如 `cd /mnt/c/path/to/your/project`)。
    3.  執行以下指令：
        ```bash
        bash run.sh
        ```
        或賦予執行權限後執行：
        ```bash
        chmod +x run.sh
        ./run.sh
        ```

#### 腳本說明

*   **`run.sh`**：
    *   此腳本為主要的執行入口。
    *   它會檢查 `company.txt` 和 `collect.js` 是否存在。
    *   逐行讀取 `company.txt` 中的公司名稱。
    *   對於每個公司名稱，它會呼叫 `collect.js` 兩次，分別處理 2023 年和 2024 年的資料。
        ```bash
        node collect.js "<公司名稱>" 2023
        node collect.js "<公司名稱>" 2024
        ```
    *   腳本會輸出處理進度及可能的警告訊息。

*   **`collect.js "<公司查詢名稱>" <年度>`**：
    *   此 Node.js 腳本是實際執行資料抓取的核心。
    *   `<公司查詢名稱>`：從 `company.txt` 傳入的公司名稱，用於查詢公司基本資料及股票代號。
    *   `<年度>`：要抓取的 ESG 報告年度。
    *   **執行流程**：
        1.  **查詢公司資訊**：
            *   嘗試從 `download/all-carbon.csv` 中讀取該公司是否已有資料 (統一編號、股票代號、股票名稱)。
            *   若無，則透過 g0v API 查詢統一編號。
            *   接著使用 Playwright 前往 ISIN 網站，以 `<公司查詢名稱>` 搜尋股票代號和股票名稱。
        2.  **檢查/下載 ESG 報告**：
            *   檢查 `download/<統一編號>-<年度>.csv` 是否已存在。
            *   若不存在，則使用 Playwright 自動登入 ESG永續報告平台，輸入股票代號和年度，搜尋並下載對應的 CSV 報告。
            *   Playwright 預設以非無頭模式 (`headless: false`) 執行，您會看到瀏覽器視窗操作過程。若要背景執行，可修改 `collect.js` 中的 `chromium.launch({ headless: true });`。
        3.  **處理碳排放資料 (`processCarbonData`)**：
            *   讀取下載的 `<統一編號>-<年度>.csv` 檔案。
            *   篩選出包含「(範疇一)」、「(範疇二)」或「(範疇三)」的資料列。
        4.  **儲存碳排放資料 (`saveCarbonData`)**：
            *   將篩選後的數據（包含公司名稱、統一編號、股票代號、股票名稱、年度及詳細欄位）附加到 `download/all-carbon.csv`。若檔案不存在則會自動建立。

### 3. 單獨執行 `collect.js` (可選)

如果您只想針對特定公司和特定年份執行一次抓取，可以直接執行 `collect.js`：

```bash
node collect.js "台灣積體電路製造股份有限公司" 2023
```