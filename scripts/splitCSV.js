#!/usr/bin/env node

/**
 * 東京都バリアフリートイレデータ分割スクリプト
 * 
 * 使用方法:
 * node scripts/splitCSV.js
 * 
 * または:
 * node scripts/splitCSV.js [入力CSVファイル] [出力ディレクトリ]
 */

const CSVSplitter = require('../utils/csvSplitter');
const path = require('path');
const fs = require('fs');

// デフォルトパス
const DEFAULT_INPUT = path.join(__dirname, '../data/barrier_free_toilets.csv');
const DEFAULT_OUTPUT = path.join(__dirname, '../data/by_municipality');

async function main() {
    try {
        // コマンドライン引数を処理
        const args = process.argv.slice(2);
        const inputFile = args[0] || DEFAULT_INPUT;
        const outputDir = args[1] || DEFAULT_OUTPUT;

        // 入力ファイルの存在確認
        if (!fs.existsSync(inputFile)) {
            console.error(`エラー: 入力ファイルが見つかりません: ${inputFile}`);
            process.exit(1);
        }

        // 出力ディレクトリの作成
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        console.log('=== 東京都バリアフリートイレデータ分割ツール ===');
        console.log(`入力ファイル: ${inputFile}`);
        console.log(`出力ディレクトリ: ${outputDir}`);
        console.log('');

        // CSVSplitterを実行
        const splitter = new CSVSplitter();
        await splitter.split(inputFile, outputDir);

        console.log('\n=== 分割完了 ===');
        console.log('以下のディレクトリにファイルが作成されました:');
        console.log(`- ${outputDir}/23ku/     (23特別区)`);
        console.log(`- ${outputDir}/tama/     (多摩地域)`);
        console.log(`- ${outputDir}/islands/  (島嶼部)`);
        console.log(`- ${outputDir}/other/    (その他)`);
        
    } catch (error) {
        console.error('エラーが発生しました:', error.message);
        process.exit(1);
    }
}

// スクリプトが直接実行された場合のみメイン関数を実行
if (require.main === module) {
    main();
}

module.exports = { main };