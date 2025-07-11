# 本番環境デプロイメント - セキュリティガイド

## 概要
このドキュメントでは、GoogleMapアプリケーションを本番環境に安全にデプロイするための手順を説明します。

## 環境変数の設定

### 1. 必須環境変数
本番環境では以下の環境変数を設定してください：

```bash
MAPTILER_API_KEY=your_production_api_key_here
```

### 2. オプション環境変数
必要に応じて以下を設定：

```bash
TOKYO_STATION_LAT=35.681
TOKYO_STATION_LNG=139.767
DEFAULT_ZOOM=15
CURRENT_LOCATION_ZOOM=15
```

## デプロイ手順

### 1. 環境変数ファイルの作成
```bash
# .envファイルを作成（.env.exampleを参考に）
cp .env.example .env

# APIキーを設定
echo "MAPTILER_API_KEY=your_production_api_key" > .env
```

### 2. セキュリティチェック
- `.env`ファイルが`.gitignore`に含まれていることを確認
- 本番用APIキーが正しく設定されていることを確認
- 開発用APIキーが本番環境で使用されていないことを確認

### 3. デプロイメント環境別設定

#### Netlify
環境変数設定ページで以下を設定：
- `MAPTILER_API_KEY`: 本番用APIキー

#### Vercel
```bash
vercel env add MAPTILER_API_KEY production
```

#### Heroku
```bash
heroku config:set MAPTILER_API_KEY=your_production_api_key
```

#### AWS / Google Cloud / Azure
各プラットフォームの環境変数設定機能を使用してAPIキーを設定

## セキュリティベストプラクティス

### 1. APIキー管理
- 開発・ステージング・本番で異なるAPIキーを使用
- APIキーの定期的なローテーション
- 使用されなくなったAPIキーの無効化

### 2. アクセス制限
- MapTiler APIキーにドメイン制限を設定
- 必要最小限の権限のみを付与

### 3. 監視とログ
- API使用量の監視
- 異常なトラフィックの検出
- ログからAPIキーが漏洩していないことを確認

## トラブルシューティング

### 地図が表示されない場合
1. APIキーが正しく設定されているか確認
2. MapTilerコンソールでAPIキーの状態を確認
3. ブラウザの開発者ツールでエラーログを確認

### 環境変数が読み込まれない場合
1. プラットフォームの環境変数設定を確認
2. アプリケーションの再起動
3. ビルドプロセスでの環境変数読み込み確認

## 緊急時対応

### APIキー漏洩時の対応
1. 漏洩したAPIキーの即座無効化
2. 新しいAPIキーの生成と設定
3. 影響範囲の調査と対応
4. セキュリティインシデントの記録

## チェックリスト

デプロイ前の確認事項：

- [ ] .envファイルが.gitignoreに含まれている
- [ ] 本番用APIキーが設定されている
- [ ] 開発用APIキーがソースコードから削除されている
- [ ] 環境変数が正しく読み込まれることを確認
- [ ] 地図が正常に表示されることを確認
- [ ] APIキーにドメイン制限が設定されている
- [ ] 監視設定が有効になっている