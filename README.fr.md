<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Vous publiez sur npm, PyPI et NuGet. Au fil du temps, les pages de votre registre deviennent obsolètes : descriptions périmées, liens vers la page d'accueil manquants, balises qui ne correspondent pas aux versions, en-têtes README sans logos. Personne ne le remarque tant qu'un utilisateur ne le signale.

**mcpt-publishing** analyse vos packages publiés sur les différents registres, détecte ces incohérences, les corrige et vous fournit un reçu prouvant les modifications apportées. Aucune dépendance. Node 22+.

## Démarrage rapide

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

C'est tout. Exécutez `audit` dans votre CI pour détecter rapidement les incohérences, ou `weekly` pour automatiser l'ensemble du processus.

---

## Ce que cela détecte

| Détection | Gravité | Exemple |
|---------|----------|---------|
| Absence de `repository` dans package.json | ROUGE | La page npm ne montre pas de lien "Repository" |
| Absence de `homepage` | ROUGE | Pas de lien vers la documentation ou la page d'accueil |
| Absence de `bugs.url` | JAUNE | Pas de lien vers le suivi des problèmes sur npm |
| Mots-clés manquants | JAUNE | Le package n'est pas visible dans les recherches |
| En-tête README obsolète | JAUNE | Pas de logo, pas de badges, liens incorrects |
| Incohérence entre la description/page d'accueil sur GitHub | JAUNE | La section "About" du dépôt ne correspond pas au registre |
| NuGet : absence de PackageProjectUrl | JAUNE | La page NuGet n'a pas de lien vers la page d'accueil |
| Incohérence entre la version de la balise et la version de la publication | ROUGE | Publication de la version v1.2.0, mais la balise indique v1.1.0 |

## Ce que cela corrige

Sept correcteurs intégrés appliquent des corrections de métadonnées autorisées :

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| Correcteur | Ce qu'il fait |
|-------|-------------|
| `npm-repository` | Définit `repository` dans package.json |
| `npm-homepage` | Définit `homepage` dans package.json |
| `npm-bugs` | Définit `bugs.url` dans package.json |
| `npm-keywords` | Ajoute des mots-clés de base à package.json |
| `readme-header` | Ajoute un logo et des liens à README.md |
| `github-about` | Définit la description/page d'accueil via l'API GitHub |
| `nuget-csproj` | Ajoute PackageProjectUrl/RepositoryUrl à .csproj |

## Publication avec reçus

Chaque publication génère un reçu JSON immuable contenant le SHA du commit, la version du registre, les hachages des artefacts et les horodatages.

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## Le pipeline hebdomadaire

Exécutez l'ensemble du processus en une seule commande : audit, correction et, éventuellement, publication :

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## Configuration de votre manifeste

Après `init`, modifiez `profiles/manifest.json` pour déclarer vos packages :

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

**Audience** contrôle le niveau de strictesse :
- `front-door` : visible publiquement. Nécessite des métadonnées propres, une balise et une version, un README correct.
- `internal` : pour les packages internes. La balise est requise, le README est facultatif.

## Facultatif : plugin d'actifs

Le cœur du système ne nécessite aucune dépendance. Les mises à jour visuelles (logos, icônes) sont gérées par un plugin facultatif :

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## Variables d'environnement

Uniquement nécessaires pour la publication ou les corrections basées sur l'API :

| Cible | Variable d'environnement | Notes |
|--------|---------|-------|
| npm | `NPM_TOKEN` | Jeton granulaire avec droits de publication |
| NuGet | `NUGET_API_KEY` | Fonctionne dans la CI ou localement |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | Pour les publications, les problèmes, GHCR |
| PyPI | `PYPI_TOKEN` | Pour la publication sur PyPI |

## Codes de sortie

| Code | Signification |
|------|---------|
| `0` | Clean : aucune incohérence détectée |
| `1` | Exception non interceptée (Node par défaut). |
| `2` | Incohérence de gravité ROUGE détectée |
| `3` | Erreur de configuration ou de schéma |
| `4` | Identifiants manquants |
| `5` | Publication échouée |
| `6` | Correction échouée |

## Reçus

Chaque opération (audit, correction, publication, actifs) écrit un reçu JSON immuable dans le répertoire `receipts/`. Chaque reçu inclut le SHA du commit, les horodatages, les hachages SHA-256 des artefacts et les URL des registres. Vérifiez n'importe quel reçu :

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## Sécurité

| Aspect | Détails |
|--------|--------|
| **Reads** | Manifestes des paquets, API des registres (npm, NuGet, PyPI). |
| **Writes** | Les fichiers de reçu sont enregistrés uniquement dans les chemins spécifiés par l'utilisateur. |
| **Network** | Les requêtes à l'API du registre sont en lecture seule, sauf pour la publication. |
| **Telemetry** | Aucun. Pas d'analyse, pas de collecte de données. |

Voir [SECURITY.md](SECURITY.md) pour signaler les vulnérabilités.

---

Créé par <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a
