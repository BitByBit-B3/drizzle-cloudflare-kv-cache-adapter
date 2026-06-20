import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

const GITHUB = 'https://github.com/BitByBit-B3/drizzle-cloudflare-kv-cache-adapter'

// https://astro.build/config
export default defineConfig({
  site: 'https://drizzle-kv-cache.bbyb.dev',
  integrations: [
    starlight({
      title: 'Drizzle KV Cache',
      favicon: '/favicon.svg',
      description:
        'Cloudflare KV query cache adapter for Drizzle ORM — cache read-heavy queries on Workers/D1 without Redis.',
      social: [{ icon: 'github', label: 'GitHub', href: GITHUB }],
      editLink: { baseUrl: `${GITHUB}/edit/main/docs/` },
      customCss: ['./src/styles/theme.css'],
      components: {
        Header: './src/components/Header.astro',
      },
      lastUpdated: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Getting started', slug: 'getting-started' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Usage', slug: 'guides/usage' },
            { label: 'Invalidation', slug: 'guides/invalidation' },
            { label: 'How it works', slug: 'guides/how-it-works' },
          ],
        },
        {
          label: 'Reference',
          items: [{ label: 'API & options', slug: 'reference/api' }],
        },
      ],
    }),
  ],
})
