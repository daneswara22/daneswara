import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_BASE_URL || 'https://daneswara.com';
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/app/', '/pos', '/login', '/admin'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
