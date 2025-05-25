#!/bin/bash

# 檢查 company.txt 是否存在
if [ ! -f "company.txt" ]; then
    echo "錯誤: company.txt 檔案不存在"
    exit 1
fi

# 檢查 grab.js 是否存在
if [ ! -f "grab.js" ]; then
    echo "錯誤: grab.js 檔案不存在"
    exit 1
fi

# 讀取 company.txt 並處理每一行
while IFS= read -r company_name || [[ -n "$company_name" ]]; do
    # 跳過空行
    if [[ -z "$company_name" ]]; then
        continue
    fi
    
    echo "處理公司: $company_name"
    
    # 執行 2023 年的命令
    echo "執行: node grab.js \"$company_name\" 2023"
    node grab.js "$company_name" 2023
    if [ $? -ne 0 ]; then
        echo "警告: $company_name (2023) 執行失敗"
    fi
    
    # 執行 2024 年的命令
    echo "執行: node grab.js \"$company_name\" 2024"
    node grab.js "$company_name" 2024
    if [ $? -ne 0 ]; then
        echo "警告: $company_name (2024) 執行失敗"
    fi
    
    echo "完成: $company_name"
    echo "---"
    
done < "company.txt"

echo "所有公司處理完成"
