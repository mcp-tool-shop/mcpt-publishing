<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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

Você publica no npm, PyPI e NuGet. Com o tempo, as páginas do seu registro se tornam desatualizadas: descrições obsoletas, links de página inicial ausentes, tags que não correspondem às versões, cabeçalhos do README sem logotipos. Ninguém percebe até que um usuário note.

O **mcpt-publishing** analisa seus pacotes publicados em diferentes registros, identifica essas inconsistências, corrige-as e gera um comprovante que registra o que aconteceu. Não possui dependências. Requer Node 22 ou superior.

## Início rápido

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

Pronto. Execute `audit` no CI para detectar inconsistências desde o início, ou `weekly` para automatizar todo o processo.

---

## O que ele detecta

| Detecção | Gravidade | Exemplo |
|---------|----------|---------|
| Falta o campo `repository` no arquivo package.json | VERMELHO | A página do npm não mostra o link "Repository". |
| Falta o campo `homepage` | VERMELHO | Não há link para a documentação ou página inicial. |
| Falta o campo `bugs.url` | AMARELO | Não há link para o rastreador de problemas no npm. |
| Faltam palavras-chave | AMARELO | O pacote não aparece nas buscas. |
| Cabeçalho do README desatualizado | AMARELO | Sem logotipo, sem selos, links incorretos. |
| Descrição/página inicial do GitHub incompatíveis. | AMARELO | A seção "About" do repositório não corresponde ao registro. |
| NuGet sem o campo `PackageProjectUrl`. | AMARELO | A página do NuGet não tem a página inicial. |
| Tag/versão da versão incompatíveis. | VERMELHO | Publicada a versão v1.2.0, mas a tag indica v1.1.0. |

## O que ele corrige

Sete corretores (fixers) integrados aplicam correções de metadados permitidas:

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| Corretor | O que ele faz |
|-------|-------------|
| `npm-repository` | Define o campo `repository` no arquivo package.json. |
| `npm-homepage` | Define o campo `homepage` no arquivo package.json. |
| `npm-bugs` | Define o campo `bugs.url` no arquivo package.json. |
| `npm-keywords` | Adiciona palavras-chave iniciais ao arquivo package.json. |
| `readme-header` | Adiciona logotipo + links ao arquivo README.md. |
| `github-about` | Define a descrição/página inicial via API do GitHub. |
| `nuget-csproj` | Adiciona `PackageProjectUrl`/`RepositoryUrl` ao arquivo .csproj. |

## Publicação com comprovantes

Cada publicação gera um comprovante JSON imutável com o hash do commit, a versão do registro, os hashes dos artefatos e os carimbos de data/hora.

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## O pipeline semanal

Execute todo o processo em um único comando: `audit`, `fix` e, opcionalmente, `publish`:

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## Configurando seu manifesto

Após o comando `init`, edite o arquivo `profiles/manifest.json` para declarar seus pacotes:

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

**Audience** controla a rigidez:
- `front-door` — voltado para o público. Requer metadados limpos, tag + versão, README adequado.
- `internal` — para pacotes internos. Tag obrigatória, README opcional.

## Opcional: plugin de ativos

O núcleo não possui dependências. As atualizações visuais (logotipos, ícones) são gerenciadas por um plugin opcional:

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## Variáveis de ambiente

Necessárias apenas para publicação ou correções baseadas em API:

| Alvo | Variável de ambiente | Observações |
|--------|---------|-------|
| npm | `NPM_TOKEN` | Token granular com permissões de publicação. |
| NuGet | `NUGET_API_KEY` | Funciona no CI ou localmente. |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | Para releases, issues, GHCR. |
| PyPI | `PYPI_TOKEN` | Para publicação no PyPI. |

## Códigos de saída

| Código | Significado |
|------|---------|
| `0` | Clean — nenhuma inconsistência encontrada. |
| `1` | Exceção não capturada (Node padrão). |
| `2` | Inconsistência de gravidade VERMELHA detectada. |
| `3` | Erro de configuração ou esquema. |
| `4` | Credenciais ausentes. |
| `5` | Publicação falhou. |
| `6` | Correção falhou. |

## Comprovantes

Cada operação (audit, fix, publish, assets) grava um comprovante JSON imutável em `receipts/`. Cada um inclui o hash do commit, os carimbos de data/hora, os hashes SHA-256 dos artefatos e os URLs do registro. Verifique qualquer comprovante:

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## Segurança

| Aspecto | Detalhes |
|--------|--------|
| **Reads** | Arquivos de manifesto do pacote, APIs de registro (npm, NuGet, PyPI). |
| **Writes** | Arquivos de recibo salvos apenas nos caminhos especificados pelo usuário. |
| **Network** | Consultas à API de registro — somente leitura, a menos que esteja publicando. |
| **Telemetry** | Nenhum. Sem análises, sem envio de dados. |

Consulte [SECURITY.md](SECURITY.md) para relatar vulnerabilidades.

---

Desenvolvido por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
