import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    short: z.string(),
    area: z.enum(['imaging', 'omics', 'clinical', 'trust']),
    order: z.number(),
    featured: z.boolean().default(true),
    role: z.string(),
    venue: z.string(),
    status: z.string(),
    year: z.number().optional(),
    with: z.string().optional(),
    numbers: z.array(z.object({ value: z.string(), label: z.string() })).min(1).max(4).optional(),
    question: z.string(),
    built: z.string().optional(),
    record: z.object({ claim: z.string(), evidence: z.string(), limits: z.string().optional() }).optional(),
    links: z.object({
      doi: z.string().optional(),
      pubmed: z.string().optional(),
      url: z.string().url().optional(),
    }).default({}),
  }),
});

// One Markdown file per highlight; its photos live in a folder of the same name next to it.
const highlights = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/highlights' }),
  schema: ({ image }) => z.object({
    title: z.string(),
    place: z.string(),
    venue: z.string(),
    date: z.string().default(''),
    order: z.number(),
    featured: z.boolean().default(false),
    summary: z.string(),
    cover: image().optional(),
    coverAlt: z.string().optional(),
    // The one photo of this highlight Google Images may show (robots.txt); the cover unless set.
    searchImage: image().optional(),
    credit: z.string().optional(),
    photos: z.array(z.object({ src: image(), alt: z.string(), caption: z.string().optional() })).default([]),
    links: z.array(z.object({ label: z.string(), href: z.string().url() })).default([]),
    color: z.enum(['amber', 'pink', 'violet', 'cyan']),
  }),
});

export const collections = { projects, highlights };
