// Search engines may crawl every page (all but the homepage are noindex), but Google Images may show only
// the portrait and one photo per highlight: its searchImage, or else its cover. Built from the highlight files,
// so a new highlight's photo is allowed without editing this.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { profile } from '../data/site';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('highlights');
  // '/_astro/name.hash.webp' -> '/_astro/name.hash', which also matches every resized copy ('name.hash_xyz.webp').
  const photos = posts.map((post) => post.data.searchImage ?? post.data.cover).filter((image) => image !== undefined).map((image) => image.src.replace(/\.[a-z0-9]+$/i, ''));
  return new Response([
    'User-agent: *',
    'Allow: /',
    '',
    'User-agent: Googlebot-Image',
    'Disallow: /',
    'Allow: /favicon', // .svg and .ico
    'Allow: /apple-touch-icon.png',
    `Allow: ${profile.photo}`,
    ...photos.map((path) => `Allow: ${path}`),
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', site).href}`,
    '',
  ].join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
