<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Publica en npm, PyPI y NuGet. Con el tiempo, las páginas de tu registro se desincronizan: descripciones obsoletas, enlaces de página de inicio faltantes, etiquetas que no coinciden con las versiones, encabezados de README sin logotipos. Nadie se da cuenta hasta que un usuario lo nota.

**mcpt-publishing** audita los paquetes publicados en diferentes registros, detecta estas desincronizaciones, las corrige y te proporciona un comprobante que muestra lo que ha ocurrido. No tiene dependencias. Requiere Node 22+.

## Inicio rápido

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

Eso es todo. Ejecuta `audit` en el sistema de integración continua (CI) para detectar desincronizaciones de forma temprana, o `weekly` para automatizar todo el proceso.

---

## Qué detecta

| Detección | Severidad | Ejemplo |
|---------|----------|---------|
| Falta el campo `repository` en package.json | ROJO | La página de npm no muestra un enlace a "Repository". |
| Falta el campo `homepage` | ROJO | No hay enlace a la documentación ni a la página de inicio. |
| Falta el campo `bugs.url` | AMARILLO | No hay enlace al rastreador de problemas en npm. |
| Faltan palabras clave | AMARILLO | El paquete no aparece en las búsquedas. |
| Encabezado de README obsoleto | AMARILLO | No hay logotipo, ni insignias, enlaces incorrectos. |
| Descripción/página de inicio de GitHub que no coinciden. | AMARILLO | La sección "Acerca de" del repositorio no coincide con el registro. |
| NuGet: falta el campo `PackageProjectUrl`. | AMARILLO | La página de NuGet no tiene una página de inicio. |
| Etiqueta/versión de la publicación que no coinciden. | ROJO | Se publicó la versión v1.2.0, pero la etiqueta indica v1.1.0. |

## Qué corrige

Siete correctores integrados aplican correcciones a los metadatos permitidos:

```bash
npx mcpt-publishing fix                                # apply locally
npx mcpt-publishing fix --remote                       # apply via GitHub API
npx mcpt-publishing fix --pr                           # open a PR with fixes
npx mcpt-publishing fix --repo owner/my-package        # fix one repo only
```

| Corrector | Qué hace |
|-------|-------------|
| `npm-repository` | Establece el campo `repository` en package.json |
| `npm-homepage` | Establece el campo `homepage` en package.json |
| `npm-bugs` | Establece el campo `bugs.url` en package.json |
| `npm-keywords` | Añade palabras clave iniciales a package.json |
| `readme-header` | Añade el logotipo y los enlaces al archivo README.md |
| `github-about` | Establece la descripción/página de inicio a través de la API de GitHub. |
| `nuget-csproj` | Añade `PackageProjectUrl`/`RepositoryUrl` al archivo .csproj. |

## Publicación con comprobantes

Cada publicación genera un comprobante JSON inmutable con el SHA del commit, la versión del registro, los hashes de los artefactos y las marcas de tiempo.

```bash
# Publish to npm with receipt
npx mcpt-publishing publish --target npm

# Verify a receipt later
npx mcpt-publishing verify-receipt receipts/publish/2026-03-01.json
```

## El ciclo semanal

Ejecuta todo el proceso con un solo comando: auditoría, corrección y, opcionalmente, publicación:

```bash
npx mcpt-publishing weekly --dry-run     # preview everything
npx mcpt-publishing weekly --pr          # audit + fix as PR
npx mcpt-publishing weekly --publish     # the full pipeline
```

---

## Configuración del manifiesto

Después de `init`, edita `profiles/manifest.json` para declarar tus paquetes:

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

**Audience** controla la rigidez:
- `front-door`: visible al público. Requiere metadatos limpios, etiqueta + versión, README adecuado.
- `internal`: admite paquetes. La etiqueta es obligatoria, el README es opcional.

## Opcional: plugin de activos

El núcleo no tiene dependencias. Las actualizaciones visuales (logotipos, iconos) se gestionan mediante un plugin opcional:

```bash
npm i -D @mcptoolshop/mcpt-publishing-assets
npx mcpt-publishing assets logo --input src.png
npx mcpt-publishing assets wire --repo owner/name
```

---

## Variables de entorno

Solo necesarias para la publicación o las correcciones basadas en la API:

| Objetivo | Variable de entorno | Notas |
|--------|---------|-------|
| npm | `NPM_TOKEN` | Token granular con permisos de publicación. |
| NuGet | `NUGET_API_KEY` | Funciona en el CI o localmente. |
| GitHub | `GITHUB_TOKEN` / `GH_TOKEN` | Para publicaciones, problemas, GHCR. |
| PyPI | `PYPI_TOKEN` | Para la publicación en PyPI. |

## Códigos de salida

| Código | Significado |
|------|---------|
| `0` | Clean: no se detectó ninguna desincronización. |
| `2` | Se detectó una desincronización de severidad ROJA. |
| `3` | Error de configuración o de esquema. |
| `4` | Credenciales faltantes. |
| `5` | La publicación falló. |
| `6` | La corrección falló. |

## Comprobantes

Cada operación (auditoría, corrección, publicación, activos) escribe un comprobante JSON inmutable en el directorio `receipts/`. Cada uno incluye el SHA del commit, las marcas de tiempo, los hashes SHA-256 de los artefactos y las URL del registro. Verifica cualquier comprobante:

```bash
npx mcpt-publishing verify-receipt receipts/audit/2026-03-01.json
```

## Seguridad

| Aspecto | Detalle |
|--------|--------|
| **Reads** | Archivos de manifiesto de paquetes, APIs de registro (npm, NuGet, PyPI). |
| **Writes** | Solo se guardan los archivos de recibo en las rutas especificadas por el usuario. |
| **Network** | Consultas a la API del registro: solo lectura, a menos que se esté publicando. |
| **Telemetry** | Ninguno. No hay análisis, ni telemetría. |

Consulte [SECURITY.md](SECURITY.md) para informar sobre vulnerabilidades.

---

Creado por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
