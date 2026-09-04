import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.PUBLIC_BASE_URL || 'https://daneswaraprint.com').replace(/\/$/, '');
  const routes = ['', '/galeri', '/gallery', '/price-list', '/order'];
  const now = new Date();
  return routes.map((r) => ({
    url: `${base}${r}`,
    lastModified: now,
    changeFrequency: (r === '' ? 'daily' : 'weekly') as any,
    priority: r === '' ? 1 : 0.7,
  }));
}
