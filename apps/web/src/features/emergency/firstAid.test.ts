import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIRST_AID_GUIDES, parseArticle, pickGuides } from './firstAid';

const knowledgeDir = resolve(__dirname, '../../../../../services/ai/knowledge');

describe('first-aid guides', () => {
  it('reads an article into its sections', () => {
    const guide = parseArticle(
      [
        '---',
        'id: heatstroke',
        'title: Heatstroke',
        'species: dog, cat',
        'urgency: emergency',
        'sources: Merck Veterinary Manual | RVC',
        '---',
        '',
        '## Summary',
        '',
        'Pets cannot cool down by sweating.',
        '',
        '## What you can do now',
        '',
        '- Move your pet to shade.',
        '- Go to a vet.',
      ].join('\r\n'),
    );
    expect(guide).toEqual({
      id: 'heatstroke',
      title: 'Heatstroke',
      species: ['dog', 'cat'],
      urgency: 'emergency',
      sources: ['Merck Veterinary Manual', 'RVC'],
      sections: [
        { heading: 'Summary', paragraphs: ['Pets cannot cool down by sweating.'], bullets: [] },
        {
          heading: 'What you can do now',
          paragraphs: [],
          bullets: ['Move your pet to shade.', 'Go to a vet.'],
        },
      ],
    });
  });

  it('includes every emergency article in the knowledge base, with wounds first', () => {
    const emergencies = readdirSync(knowledgeDir)
      .filter((file) => file.endsWith('.md') && file !== 'README.md')
      .map((file) => parseArticle(readFileSync(resolve(knowledgeDir, file), 'utf8')))
      .filter((article) => article.urgency === 'emergency')
      .map((article) => article.id);
    const ids = FIRST_AID_GUIDES.map((guide) => guide.id);

    expect(emergencies.length).toBeGreaterThan(5);
    for (const id of emergencies) expect(ids).toContain(id);
    expect(ids[0]).toBe('wound-first-aid');
    expect(ids).toContain('injured-stray-animal');
    expect(ids).not.toContain('dental-care'); // routine articles are left out
  });

  it('gives every guide a title and advice on when to get help', () => {
    for (const guide of FIRST_AID_GUIDES) {
      expect(guide.title).not.toBe('');
      expect(guide.sections.length).toBeGreaterThan(1);
      const headings = guide.sections.map((section) => section.heading);
      expect(headings.some((h) => /Get help now|See a vet|What you can do/.test(h))).toBe(true);
    }
  });

  it('leaves out articles that are not about emergencies', () => {
    const routine = { ...parseArticle('---\nid: x\nurgency: routine\n---\n'), title: 'X' };
    expect(pickGuides([routine])).toEqual([]);
  });
});
