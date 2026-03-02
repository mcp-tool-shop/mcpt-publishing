<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop/mcpt-publishing/main/logo.png" alt="mcpt-publishing logo" width="520" />
</p>

<p align="center">
  Catch registry drift before your users do.
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop/mcpt-publishing/releases"><img alt="GitHub release" src="https://img.shields.io/github/v/release/mcp-tool-shop/mcpt-publishing?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/@mcptoolshop/mcpt-publishing"><img alt="npm" src="https://img.shields.io/npm/v/@mcptoolshop/mcpt-publishing?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
</p>

---

npm、PyPI、NuGet への公開時に、公開済みのパッケージの情報が徐々に古くなっていきます。説明文が古くなったり、ホームページへのリンクがなくなったり、リリースとタグが一致しなかったり、ロゴのない README が表示されたりします。ユーザーがそれに気づくまでは、誰も問題に気づきません。

**mcpt-publishing** は、公開済みのパッケージを各レジストリで監査し、情報のずれを検出し、修正し、何が起こったかを証明するレシートを発行します。依存関係はゼロです。Node 22 以降が必要です。

## クイックスタート

```bash
# Scaffold config + profiles
npx mcpt-publishing init

# Audit everything — writes reports/latest.md + receipt
npx mcpt-publishing audit

# Preview what fix would change
npx mcpt-publishing fix --dry-run

# Apply fixes
npx mcpt-publishing fix
```

これだけで完了です。CI で `audit` コマンドを実行して、早期にずれを検出し、または `weekly` コマンドを実行して、完全なサイクルを自動化します。

---

## 検出されるもの

| 検出内容 | 重要度 | 例 |
|---------|----------|---------|
| package.json に `repository` が存在しない | RED | npm のページに "Repository" へのリンクがない |
| `homepage` が存在しない | RED | ドキュメントやランディングページへのリンクがない |
| `bugs.url` が存在しない | YELLOW | npm に問題追跡へのリンクがない |
| キーワードが不足している | YELLOW | 検索エンジンに表示されないパッケージ |
| README のヘッダーが古くなっている | YELLOW | ロゴがない、バッジがない、リンクが間違っている |
| GitHub の説明文とホームページが一致しない | YELLOW | リポジトリの "About" がレジストリと一致しない |
| NuGet に PackageProjectUrl が存在しない | YELLOW | NuGet のページにホームページがない |
| タグとリリースバージョンが一致しない | RED | v1.2.0 が公開されているが、タグは v1.1.0 となっている |

## 修正されるもの

7 つの組み込み修正機能があり、許可リストに登録されたメタデータ修正を行います。

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| 修正機能 | 機能 |
|-------|-------------|
| `npm-repository` | package.json に `repository` を設定する |
| `npm-homepage` | package.json に `homepage` を設定する |
| `npm-bugs` | package.json に `bugs.url` を設定する |
| `npm-keywords` | package.json に基本的なキーワードを追加する |
| `readme-header` | README.md にロゴとリンクを追加する |
| `github-about` | GitHub API を使用して、説明文とホームページを設定する |
| `nuget-csproj` | .csproj に PackageProjectUrl/RepositoryUrl を追加する |

## レシート付きでの公開

公開ごとに、コミットの SHA、レジストリのバージョン、アーティファクトのハッシュ値、タイムスタンプを含む、不変の JSON レシートが生成されます。

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## 毎週のパイプライン

1 つのコマンドで、監査、修正、オプションで公開という完全なサイクルを実行します。

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## マニフェストの設定

`init` コマンド実行後、`profiles/manifest.json` を編集して、パッケージを宣言します。

```json
{
  "npm": [
    { "name": "@yourscope/my-tool", "repo": "your-org/my-tool", "audience": "front-door" }
  ],
  "pypi": [
    { "name": "my-tool", "repo": "your-org/my-tool", "audience": "front-door" }
  ],
  "nuget": [
    { "name": "MyTool.Core", "repo": "your-org/my-tool", "audience": "internal" }
  ]
}
```

**Audience** は厳格さを制御します。
- `front-door`：パブリック向け。クリーンなメタデータ、タグとリリース、適切な README が必要です。
- `internal`：パッケージサポート向け。タグは必須、README はオプションです。

## オプション：アセットプラグイン

コアは依存関係がありません。視覚的な更新（ロゴ、アイコン）は、オプションのプラグインによって処理されます。

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## 環境変数

公開または API ベースの修正を行う場合にのみ必要です。

| ターゲット | 環境変数 | 備考 |
|--------|---------|-------|
| npm | `NPM_TOKEN` | 公開権限を持つ粒度の細かいトークン |
| NuGet | `NUGET_API_KEY` | CI 環境またはローカル環境で使用可能 |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | リリース、イシュー、GHCR 用 |
| PyPI | `PYPI_TOKEN` | PyPI への公開用 |

## 終了コード

| コード | 意味 |
|------|---------|
| `0` | Clean：ずれが見つからなかった |
| `2` | RED：重要度のずれが検出された |
| `3` | 構成またはスキーマのエラー |
| `4` | 認証情報が不足している |
| `5` | 公開に失敗した |
| `6` | 修正に失敗した |

## レシート

監査、修正、公開、アセットなど、すべての操作で、不変の JSON レシートが `receipts/` ディレクトリに書き込まれます。それぞれに、コミットの SHA、タイムスタンプ、アーティファクトの SHA-256 ハッシュ値、およびレジストリの URL が含まれます。任意のレシートを検証できます。

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## セキュリティ

| 側面 | 詳細 |
|--------|--------|
| **Reads** | パッケージのマニフェスト、レジストリAPI（npm、NuGet、PyPI） |
| **Writes** | レシートファイルは、ユーザーが指定したパスにのみ保存されます。 |
| **Network** | レジストリAPIへのアクセスは、パブリッシュする場合を除き、読み取り専用です。 |
| **Telemetry** | なし。分析機能も、テレメトリー機能もありません。 |

脆弱性に関する報告は、[SECURITY.md](SECURITY.md) を参照してください。

---

作成者：<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
