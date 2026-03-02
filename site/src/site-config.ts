import type { SiteConfig } from '@mcptoolshop/site-theme';

export const config: SiteConfig = {
  title: 'mcpt-publishing',
  description: 'Catch registry drift before your users do. Multi-registry publishing auditor for npm, PyPI, and NuGet.',
  logoBadge: 'MP',
  brandName: 'mcpt-publishing',
  repoUrl: 'https://github.com/mcp-tool-shop/mcpt-publishing',
  npmUrl: 'https://www.npmjs.com/package/@mcptoolshop/mcpt-publishing',
  footerText: 'MIT Licensed — built by <a href="https://mcp-tool-shop.github.io/" style="color:var(--color-muted);text-decoration:underline">MCP Tool Shop</a>',

  hero: {
    badge: 'v1.1.0',
    headline: 'Your registry pages',
    headlineAccent: 'are drifting.',
    description: 'Stale descriptions, missing links, wrong tags. mcpt-publishing audits your packages across npm, PyPI, and NuGet — then fixes the drift and gives you a receipt.',
    primaryCta: { href: '#quickstart', label: 'Get started' },
    secondaryCta: { href: '#what-it-catches', label: 'See what it catches' },
    previews: [
      { label: 'Audit', code: 'npx mcpt-publishing audit' },
      { label: 'Fix', code: 'npx mcpt-publishing fix --dry-run' },
      { label: 'Verify', code: 'npx mcpt-publishing verify-receipt receipts/audit/latest.json' },
    ],
  },

  sections: [
    {
      kind: 'features',
      id: 'what-it-catches',
      title: 'What it catches',
      subtitle: 'Registry drift that accumulates silently across every package you publish.',
      features: [
        { title: 'Missing metadata', desc: 'No repository link, no homepage, no bugs URL — your npm/PyPI page looks abandoned even when the code is active.' },
        { title: 'Stale README headers', desc: 'Logo missing, badges broken, links pointing to old URLs. The first thing users see is wrong.' },
        { title: 'Tag/version mismatch', desc: 'Published v1.2.0 but the tag says v1.1.0. Releases that don\'t match what\'s on the registry.' },
      ],
    },
    {
      kind: 'code-cards',
      id: 'quickstart',
      title: 'Quickstart',
      cards: [
        {
          title: 'Scaffold & audit',
          code: [
            '# Initialize config + profiles',
            'npx mcpt-publishing init',
            '',
            '# Run your first audit',
            'npx mcpt-publishing audit',
            '',
            '# reports/latest.md shows every finding',
          ].join('\n'),
        },
        {
          title: 'Fix & verify',
          code: [
            '# Preview what fix would change',
            'npx mcpt-publishing fix --dry-run',
            '',
            '# Apply fixes and get a receipt',
            'npx mcpt-publishing fix',
            '',
            '# Verify the receipt',
            'npx mcpt-publishing verify-receipt \\',
            '  receipts/fix/latest.json',
          ].join('\n'),
        },
      ],
    },
    {
      kind: 'data-table',
      id: 'fixers',
      title: 'Built-in fixers',
      subtitle: 'Seven allowlisted corrections that bring your registry pages into shape.',
      columns: ['Fixer', 'Registry', 'What it does'],
      rows: [
        ['npm-repository', 'npm', 'Sets repository field in package.json'],
        ['npm-homepage', 'npm', 'Sets homepage link in package.json'],
        ['npm-bugs', 'npm', 'Sets bugs.url in package.json'],
        ['npm-keywords', 'npm', 'Adds starter keywords for discoverability'],
        ['readme-header', 'All', 'Adds logo, badges, and links to README'],
        ['github-about', 'GitHub', 'Sets repo description and homepage'],
        ['nuget-csproj', 'NuGet', 'Adds PackageProjectUrl and RepositoryUrl'],
      ],
    },
    {
      kind: 'features',
      id: 'design',
      title: 'How it\'s built',
      subtitle: 'Small, fast, and safe by default.',
      features: [
        { title: 'Zero dependencies', desc: 'Core has no npm dependencies. Installs in under a second. Uses native fetch().' },
        { title: 'Immutable receipts', desc: 'Every audit, fix, and publish generates a JSON receipt with SHA-256 hashes, commit SHAs, and timestamps.' },
        { title: 'No surprises', desc: 'Fix mode is allowlisted — it only touches metadata fields. No surprise publishes, no source code changes.' },
      ],
    },
  ],
};
