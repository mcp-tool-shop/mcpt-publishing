<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Pubblicate su npm, PyPI e NuGet. Nel tempo, le pagine del vostro registro tendono a discostarsi: descrizioni obsolete, link alla homepage mancanti, tag che non corrispondono alle versioni, intestazioni del file README senza loghi. Nessuno se ne accorge finché un utente non lo fa.

**mcpt-publishing** analizza i pacchetti pubblicati su diversi registri, rileva queste discrepanze, le corregge e vi fornisce una ricevuta che attesta le modifiche apportate. Nessuna dipendenza. Node 22+.

## Guida rapida

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

Ecco tutto. Eseguite `audit` nell'ambiente di integrazione continua per rilevare tempestivamente le discrepanze, oppure `weekly` per automatizzare l'intero processo.

---

## Cosa rileva

| Rilevamento | Gravità | Esempio |
|---------|----------|---------|
| Manca il campo `repository` in package.json | ROSSO | La pagina npm non mostra il link "Repository" |
| Manca il campo `homepage` | ROSSO | Nessun link alla documentazione o alla pagina di destinazione |
| Manca il campo `bugs.url` | GIALLO | Nessun link al sistema di tracciamento dei problemi su npm |
| Mancano le parole chiave | GIALLO | Il pacchetto non è visibile nelle ricerche |
| Intestazione del file README obsoleta | GIALLO | Nessun logo, nessuna icona, link errati |
| Descrizione/homepage non corrispondenti su GitHub | GIALLO | La sezione "About" del repository non corrisponde al registro |
| NuGet: manca il campo `PackageProjectUrl` | GIALLO | La pagina NuGet non ha la homepage |
| Tag/versione non corrispondenti | ROSSO | Pubblicata la versione 1.2.0, ma il tag indica la versione 1.1.0 |

## Cosa corregge

Sono disponibili sette correttori integrati che applicano correzioni ai metadati consentite:

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| Correttore | Cosa fa |
|-------|-------------|
| `npm-repository` | Imposta il campo `repository` in package.json |
| `npm-homepage` | Imposta il campo `homepage` in package.json |
| `npm-bugs` | Imposta il campo `bugs.url` in package.json |
| `npm-keywords` | Aggiunge le parole chiave iniziali al file package.json |
| `readme-header` | Aggiunge il logo e i link al file README.md |
| `github-about` | Imposta la descrizione/homepage tramite l'API di GitHub |
| `nuget-csproj` | Aggiunge `PackageProjectUrl`/`RepositoryUrl` al file .csproj |

## Pubblicazione con ricevute

Ogni pubblicazione genera una ricevuta JSON immutabile contenente l'hash SHA del commit, la versione del registro, gli hash degli artefatti e i timestamp.

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## La pipeline settimanale

Eseguite l'intero ciclo con un solo comando: analisi, correzione e, facoltativamente, pubblicazione:

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## Configurazione del manifest

Dopo l'esecuzione di `init`, modificate il file `profiles/manifest.json` per dichiarare i vostri pacchetti:

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

`Audience` controlla il livello di rigore:
- `front-door`: rivolto al pubblico. Richiede metadati puliti, tag e versione corrispondenti, file README appropriato.
- `internal`: supporta i pacchetti. Richiede il tag, il file README è facoltativo.

## Opzionale: plugin per gli asset

Il core non ha dipendenze. Gli aggiornamenti visivi (loghi, icone) sono gestiti da un plugin opzionale:

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## Variabili d'ambiente

Necessarie solo per la pubblicazione o per le correzioni basate sull'API:

| Target | Variabile d'ambiente | Note |
|--------|---------|-------|
| npm | `NPM_TOKEN` | Token granulare con diritti di pubblicazione |
| NuGet | `NUGET_API_KEY` | Funziona nell'ambiente di integrazione continua o localmente |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | Per le release, i problemi, GHCR |
| PyPI | `PYPI_TOKEN` | Per la pubblicazione su PyPI |

## Codici di uscita

| Codice | Significato |
|------|---------|
| `0` | Clean: nessuna discrepanza rilevata |
| `1` | Eccezione non gestita (comportamento predefinito di Node) |
| `2` | Discrepanza di gravità ROSSA rilevata |
| `3` | Errore di configurazione o di schema |
| `4` | Credenziali mancanti |
| `5` | Pubblicazione fallita |
| `6` | Correzione fallita |

## Ricevute

Ogni operazione (analisi, correzione, pubblicazione, asset) scrive una ricevuta JSON immutabile nella cartella `receipts/`. Ognuna include l'hash SHA del commit, i timestamp, gli hash SHA-256 degli artefatti e gli URL del registro. Verificate qualsiasi ricevuta:

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## Sicurezza

| Aspetto | Dettaglio |
|--------|--------|
| **Reads** | File di manifest dei pacchetti, API dei registri (npm, NuGet, PyPI) |
| **Writes** | I file di ricevuta vengono salvati solo nei percorsi specificati dall'utente. |
| **Network** | Le query alle API dei registri sono in sola lettura, a meno che non si stia pubblicando. |
| **Telemetry** | Nessuno. Nessuna analisi, nessuna trasmissione di dati. |

Consultare il file [SECURITY.md](SECURITY.md) per la segnalazione di vulnerabilità.

---

Creato da <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
