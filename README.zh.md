<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

您将软件包发布到 npm、PyPI 和 NuGet。 随着时间的推移，您的注册页面可能会出现偏差：描述信息过时、缺少主页链接、标签与发布版本不匹配、README 文件缺少徽标。 直到用户发现，没有人会注意到。

**mcpt-publishing** 会检查您在各个注册中心发布的软件包，发现偏差，并自动修复，并提供一份记录，证明发生了什么。 零依赖。 Node 22+。

## 快速入门

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

就是这样。 在 CI 环境中运行 `audit` 命令以尽早发现偏差，或者运行 `weekly` 命令以自动化整个流程。

---

## 它可以检测到的问题

| 发现 | 严重程度 | 示例 |
|---------|----------|---------|
| package.json 文件中缺少 `repository` | 红色 | npm 页面上没有 "Repository" 链接 |
| 缺少 `homepage` | 红色 | 没有指向文档或主页的链接 |
| 缺少 `bugs.url` | 黄色 | npm 上没有问题跟踪器链接 |
| 缺少关键词 | 黄色 | 软件包在搜索中不可见 |
| README 文件的标题信息过时 | 黄色 | 没有徽标，没有链接，链接错误 |
| GitHub 描述/主页信息不一致 | 黄色 | 仓库的 "关于" 描述与注册中心信息不一致 |
| NuGet 缺少 PackageProjectUrl | 黄色 | NuGet 页面上没有主页 |
| 标签/发布版本不匹配 | 红色 | 发布了 v1.2.0 版本，但标签显示为 v1.1.0 |

## 它可以自动修复的问题

七个内置的修复程序，可以应用允许列表中的元数据更正：

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| 修复程序 | 它所做的事情 |
|-------|-------------|
| `npm-repository` | 在 package.json 文件中设置 `repository` |
| `npm-homepage` | 在 package.json 文件中设置 `homepage` |
| `npm-bugs` | 在 package.json 文件中设置 `bugs.url` |
| `npm-keywords` | 在 package.json 文件中添加初始关键词 |
| `readme-header` | 在 README.md 文件中添加徽标和链接 |
| `github-about` | 通过 GitHub API 设置描述/主页 |
| `nuget-csproj` | 在 .csproj 文件中添加 PackageProjectUrl/RepositoryUrl |

## 带有记录的发布

每次发布都会生成一个不可变的 JSON 记录，其中包含提交 SHA、注册中心版本、工件哈希值和时间戳。

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## 每周流水线

使用一个命令完成整个流程——检查、修复，并可选地发布：

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## 配置您的清单

在运行 `init` 命令后，编辑 `profiles/manifest.json` 文件以声明您的软件包：

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

**Audience** 控制严格程度：
- `front-door`：面向公共用户。 需要干净的元数据、标签和发布版本、正确的 README 文件。
- `internal`：支持软件包。 需要标签，README 文件可选。

## 可选：assets 插件

核心功能不依赖任何其他库。 视觉更新（徽标、图标）由一个可选的插件处理：

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## 环境变量

仅在发布或基于 API 的修复时需要：

| 目标 | 环境变量 | 说明 |
|--------|---------|-------|
| npm | `NPM_TOKEN` | 具有发布权限的细粒度令牌 |
| NuGet | `NUGET_API_KEY` | 可以在 CI 环境或本地运行 |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | 用于发布、问题和 GHCR |
| PyPI | `PYPI_TOKEN` | 用于 PyPI 发布 |

## 退出码

| 代码 | 含义 |
|------|---------|
| `0` | Clean：未发现偏差 |
| `2` | RED-severity：检测到严重偏差 |
| `3` | 配置或模式错误 |
| `4` | 缺少凭据 |
| `5` | 发布失败 |
| `6` | 修复失败 |

## 记录

每个操作（检查、修复、发布、assets）都会将一个不可变的 JSON 记录写入 `receipts/` 目录。 每个记录都包含提交 SHA、时间戳、工件 SHA-256 哈希值和注册中心 URL。 验证任何记录：

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## 安全

| 方面 | 细节 |
|--------|--------|
| **Reads** | 软件包清单，注册表API（npm、NuGet、PyPI）。 |
| **Writes** | 仅将收据文件保存到用户指定的路径。 |
| **Network** | 对注册表API的查询为只读模式，除非进行发布。 |
| **Telemetry** | 无。不收集任何分析数据，也不进行任何数据传输。 |

有关漏洞报告，请参阅[SECURITY.md](SECURITY.md)。

---

由<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>构建。
