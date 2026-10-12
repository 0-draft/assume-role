# assume-role

[![ci](https://github.com/0-draft/assume-role/actions/workflows/ci.yml/badge.svg)](https://github.com/0-draft/assume-role/actions/workflows/ci.yml)
[![codeql](https://github.com/0-draft/assume-role/actions/workflows/codeql.yml/badge.svg)](https://github.com/0-draft/assume-role/actions/workflows/codeql.yml)

AWS STS を図解するサイトです。英語と日本語に対応したインタラクティブな解説で、AWS Security Token Service のグローバルエンドポイントと、リージョン・FIPS・デュアルスタック・PrivateLink の各ホスト名、STS の API 11 個すべて、ワークロードや人が一時認証情報を手にするまでの全経路、それにまつわるポリシー・上限・エラーを扱います。

**サイト:** <https://0-draft.github.io/assume-role/?lang=ja> ([English](https://0-draft.github.io/assume-role/))

[English README](README.md)

## 中身

| # | 章 | 触れるもの |
| --- | --- | --- |
| — | ヒーロー | 誰が頼んでいるか (開発者、CI ジョブ、SAML ユーザー、EC2、MFA 付き管理者、Organizations 管理者) を選ぶと、STS が認証情報のパスを発行。有効期限のカウントダウン付き |
| 1 | なぜ一時認証か | 長期キーと一時キーの比較、漏えい時に使われ続ける期間のスライダー |
| 2 | エンドポイント | `sts.amazonaws.com` やリージョナルのホスト名を呼んだとき、どこで処理され、どこに記録され、どの枠でスロットリングされるかを 2025 年 4 月の変更前後で比べるシミュレーター。全パーティションのホスト名ビルダー、SDK の既定値エクスプローラー、商用 34 リージョンの一覧ボード |
| 3 | 全 API | 「何を持っているか」から 11 個の操作を引くピッカー、CLI 例付きの詳細、期間ルーラー、比較表、アクセスキーのプレフィックス判定 |
| 4 | 取得経路 | EC2、Lambda、ECS、IRSA、Pod Identity、Roles Anywhere、GitHub Actions、Identity Center、`aws login`、SAML、Cognito、AssumeRoot、アウトバウンドフェデレーションのシーケンス図をステップ実行。認証情報プロバイダーチェーンのラボ |
| 5 | セッション | 実効権限のゲート、ロールチェーンのビルダー (1 時間上限、推移タグ、ソースアイデンティティ)、セッショントークンのサイズメーター、セッション失効のタイムライン |
| 6 | 信頼ポリシー | 2 つのゲートのラボ、GitHub OIDC の信頼ポリシー評価、混乱した代理問題のウォークスルー、条件キーのカタログ |
| 7 | ログと上限 | 注釈付き CloudTrail レコード、600 RPS クォータのラボ、脅威カードと強化チェックリスト |
| 8 | エラー | エラーメッセージを貼ると原因と対処を表示 |
| 9–10 | 年表、用語集 | 2011〜2026 年の STS の歴史、EN/JA の用語 43 個 |

数値の裏付けは [`docs/`](docs/README.md) に出典付きでまとめています。2026-10-10 時点の AWS ドキュメント、What's New、AWS SDK のエンドポイントデータ、GitHub の changelog で確認しました。AWS の情報源同士で食い違う箇所は、その旨を書いています。

SigV4 署名そのものは姉妹プロジェクト [caller-identity](https://github.com/0-draft/caller-identity) で図解しています。こちらは STS が主役です。

## 開発

Node.js 24 が必要です。

```bash
npm ci
npm run dev        # http://localhost:5173/assume-role/
npm run check      # 型チェック、lint、フォーマット、markdownlint、テスト、ビルド
npm run test:e2e   # 実ブラウザでのチェック (要: npx playwright install chromium)
```

ソースは機能ごとに分けています。`src/features/<章>/` に章のコンポーネント、ラボ、その裏の純粋関数と Vitest のテストが並びます。共通 UI は `src/components/`、ナビゲーションのデータは `src/data/`、言語切り替えは `src/i18n/` です。

## CI

| ワークフロー | 内容 |
| --- | --- |
| `ci.yml` | 型チェック、ESLint、Prettier、markdownlint、ビルド、カバレッジ付き Vitest、Playwright E2E と axe による WCAG 2.2 AA チェック (デスクトップ/スマホ × EN/JA × ライト/ダーク)、actionlint、`npm audit`、PR での dependency review。`main` がすべて緑なら GitHub Pages にデプロイ |
| `codeql.yml` | JavaScript/TypeScript と GitHub Actions の CodeQL |
| `freshness.yml` | エンドポイントの挙動・SDK の既定値・API・上限・年表を再確認する issue を毎月立てる |
| `claude-review.yml` | PR ごとに Claude が事実の正確さと EN/JA の内容一致をレビュー。コメントのみでマージは止めない |
| Dependabot | npm と GitHub Actions をグループ化して週次更新 |

## ライセンス

コードは [MIT License](./LICENSE)、`docs/` のドキュメントは [CC BY 4.0](./LICENSE-docs.md) です。

## 免責

Amazon Web Services とは無関係の個人プロジェクトです。表示しているアカウント ID・キー・トークンはすべて架空です。STS の挙動は変わることがあるので、細部に頼る前にリンク先の AWS ドキュメントを確認してください。
