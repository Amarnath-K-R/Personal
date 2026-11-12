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

export const collections = { projects };
