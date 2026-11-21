/**
 * First-aid guides for the emergency page, taken from the pet-care assistant's knowledge base
 * (services/ai/knowledge). They are built into the app, so they also work offline, and there
 * is only one copy of the advice to keep up to date.
 */

export interface GuideSection {
  heading: string;
  paragraphs: string[];
  bullets: string[];
}

export interface FirstAidGuide {
  id: string;
  title: string;
  species: string[];
  urgency: string;
  sections: GuideSection[];
  sources: string[];
}

/** Articles shown besides every "emergency" article: the most common first-aid situations. */
const ALSO_SHOWN = ['wound-first-aid', 'injured-stray-animal'];

/** Reads one knowledge-base article: the front matter and its "## " sections. */
export function parseArticle(markdown: string): FirstAidGuide {
  const text = markdown.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error('Article has no front matter');
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }

  const sections: GuideSection[] = [];
  let current: GuideSection | null = null;
  for (const raw of match[2]!.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      current = { heading: line.slice(3).trim(), paragraphs: [], bullets: [] };
      sections.push(current);
    } else if (current && line.startsWith('- ')) {
      current.bullets.push(line.slice(2).trim());
    } else if (current && line) {
      current.paragraphs.push(line);
    }
  }

  const list = (value = '', separator: string) =>
    value
      .split(separator)
      .map((item) => item.trim())
      .filter(Boolean);
  return {
    id: meta.id ?? '',
    title: meta.title ?? '',
    species: list(meta.species, ','),
    urgency: meta.urgency ?? '',
    sections,
    sources: list(meta.sources, '|'),
  };
}

/** Emergency articles plus the common first-aid ones; wounds first, then by title. */
export function pickGuides(articles: FirstAidGuide[]): FirstAidGuide[] {
  return articles
    .filter((article) => article.urgency === 'emergency' || ALSO_SHOWN.includes(article.id))
    .sort((a, b) => {
      const rank = (g: FirstAidGuide) => (g.id === 'wound-first-aid' ? 0 : 1);
      return rank(a) - rank(b) || a.title.localeCompare(b.title);
    });
}

const files = import.meta.glob<string>('../../../../../services/ai/knowledge/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const FIRST_AID_GUIDES: FirstAidGuide[] = pickGuides(
  Object.entries(files)
    .filter(([path]) => !path.endsWith('/README.md'))
    .map(([, markdown]) => parseArticle(markdown)),
);
