/**
 * CSV Splitter for Tokyo Barrier-Free Toilet Data
 * 東京都バリアフリートイレデータを市区町村別に分割するユーティリティ
 */

const fs = require('fs');
const path = require('path');

class CSVSplitter {
    constructor() {
        this.municipalities = new Map();
        this.stats = {
            totalRecords: 0,
            totalMunicipalities: 0,
            errors: []
        };
    }

    /**
     * 住所から市区町村名を抽出
     * @param {string} address - 住所文字列
     * @returns {string|null} 市区町村名
     */
    extractMunicipality(address) {
        // 住所形式: "東京都 [市区町村名] [詳細住所]"
        const match = address.match(/^東京都\s+(.+?[区市町村])/);
        if (match) {
            return match[1].trim();
        }
        return null;
    }

    /**
     * 市区町村の種別を判定
     * @param {string} municipality - 市区町村名
     * @returns {string} 種別 (23ku, tama, islands)
     */
    getMunicipalityType(municipality) {
        if (municipality.endsWith('区')) {
            return '23ku';
        } else if (municipality.endsWith('市')) {
            return 'tama';
        } else if (municipality.endsWith('町') || municipality.endsWith('村')) {
            return 'islands';
        }
        return 'other';
    }

    /**
     * 市区町村名をファイル名に変換
     * @param {string} municipality - 市区町村名
     * @returns {string} ファイル名
     */
    municipalityToFilename(municipality) {
        const conversions = {
            '区': '_ku',
            '市': '_shi',
            '町': '_machi',
            '村': '_mura'
        };

        let filename = municipality;
        for (const [suffix, replacement] of Object.entries(conversions)) {
            if (filename.endsWith(suffix)) {
                filename = filename.slice(0, -suffix.length) + replacement;
                break;
            }
        }

        // ひらがな・カタカナ・漢字をローマ字に変換（簡易版）
        const romanMap = {
            '港': 'minato',
            '新宿': 'shinjuku',
            '千代田': 'chiyoda',
            '台東': 'taito',
            '墨田': 'sumida',
            '江東': 'koto',
            '中野': 'nakano',
            '杉並': 'suginami',
            '豊島': 'toshima',
            '北': 'kita',
            '板橋': 'itabashi',
            '練馬': 'nerima',
            '足立': 'adachi',
            '大田': 'ota',
            '渋谷': 'shibuya',
            '目黒': 'meguro',
            '世田谷': 'setagaya',
            '立川': 'tachikawa',
            '清瀬': 'kiyose',
            '国分寺': 'kokubunji',
            '小平': 'kodaira',
            '小金井': 'koganei',
            '調布': 'chofu',
            '大島': 'oshima',
            '八丈': 'hachijo',
            '三宅': 'miyake',
            '小笠原': 'ogasawara'
        };

        for (const [kanji, roman] of Object.entries(romanMap)) {
            if (filename.includes(kanji)) {
                filename = filename.replace(kanji, roman);
                break;
            }
        }

        return filename + '.csv';
    }

    /**
     * CSVデータを解析してグループ化
     * @param {string} csvContent - CSVファイルの内容
     */
    parseCSV(csvContent) {
        const lines = csvContent.split('\n');
        const header = lines[0];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            try {
                // CSV行を解析（簡易版）
                const columns = this.parseCSVLine(line);
                if (columns.length < 2) continue;

                const address = columns[1]; // address列
                const municipality = this.extractMunicipality(address);

                if (municipality) {
                    if (!this.municipalities.has(municipality)) {
                        this.municipalities.set(municipality, {
                            name: municipality,
                            type: this.getMunicipalityType(municipality),
                            filename: this.municipalityToFilename(municipality),
                            records: []
                        });
                    }

                    this.municipalities.get(municipality).records.push(line);
                    this.stats.totalRecords++;
                } else {
                    this.stats.errors.push(`住所解析エラー: ${address}`);
                }
            } catch (error) {
                this.stats.errors.push(`行解析エラー: ${line}`);
            }
        }

        this.stats.totalMunicipalities = this.municipalities.size;
    }

    /**
     * CSV行を解析（簡易版）
     * @param {string} line - CSV行
     * @returns {Array<string>} 列データ
     */
    parseCSVLine(line) {
        const columns = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"' && (i === 0 || line[i-1] === ',')) {
                inQuotes = true;
            } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
                inQuotes = false;
            } else if (char === ',' && !inQuotes) {
                columns.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current) {
            columns.push(current.trim());
        }
        
        return columns;
    }

    /**
     * 分割されたCSVファイルを保存
     * @param {string} outputDir - 出力ディレクトリ
     * @param {string} header - CSVヘッダー
     */
    async saveFiles(outputDir, header) {
        // ディレクトリ構造を作成
        const dirs = {
            '23ku': path.join(outputDir, '23ku'),
            'tama': path.join(outputDir, 'tama'),
            'islands': path.join(outputDir, 'islands'),
            'other': path.join(outputDir, 'other')
        };

        for (const dir of Object.values(dirs)) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // 各市区町村のファイルを保存
        for (const [name, data] of this.municipalities) {
            const dir = dirs[data.type] || dirs['other'];
            const filepath = path.join(dir, data.filename);
            
            const content = [header, ...data.records].join('\n');
            fs.writeFileSync(filepath, content, 'utf8');
            
            console.log(`保存完了: ${filepath} (${data.records.length}件)`);
        }
    }

    /**
     * 統計情報を表示
     */
    showStats() {
        console.log('\n=== 分割統計 ===');
        console.log(`総レコード数: ${this.stats.totalRecords}`);
        console.log(`市区町村数: ${this.stats.totalMunicipalities}`);
        
        console.log('\n=== 市区町村別件数 ===');
        const sorted = Array.from(this.municipalities.entries())
            .sort(([,a], [,b]) => b.records.length - a.records.length);
        
        for (const [name, data] of sorted) {
            console.log(`${name}: ${data.records.length}件`);
        }

        if (this.stats.errors.length > 0) {
            console.log('\n=== エラー ===');
            this.stats.errors.forEach(error => console.log(error));
        }
    }

    /**
     * メイン処理
     * @param {string} inputFile - 入力CSVファイル
     * @param {string} outputDir - 出力ディレクトリ
     */
    async split(inputFile, outputDir) {
        console.log(`CSVファイル分割開始: ${inputFile}`);
        
        // CSVファイルを読み込み
        const csvContent = fs.readFileSync(inputFile, 'utf8');
        const lines = csvContent.split('\n');
        const header = lines[0];
        
        // データを解析
        this.parseCSV(csvContent);
        
        // ファイルを保存
        await this.saveFiles(outputDir, header);
        
        // 統計情報を表示
        this.showStats();
        
        console.log(`\n分割完了: ${outputDir}`);
    }
}

module.exports = CSVSplitter;