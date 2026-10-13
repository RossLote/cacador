import { describe, expect, it } from 'vitest';
import { manifest } from '../src/index';

// Tiling (sections, chunks and topics cover 1 to 506 without gaps or crossings) is the
// validator's job; validate.test.ts runs it on the real data. These tests pin the content.

describe('manifest sections', () => {
  it('has 11 sections with unique slugs', () => {
    expect(manifest.sections).toHaveLength(11);
    expect(new Set(manifest.sections.map((s) => s.slug)).size).toBe(11);
  });


  it('records each PDF heading in capitals', () => {
    for (const s of manifest.sections) {
      expect(s.heading).toBe(s.heading.toLocaleUpperCase('pt-PT'));
      expect(s.heading.trim()).toBe(s.heading);
      expect(s.pt).not.toBe('');
      expect(s.en).not.toBe('');
    }
  });
});

describe('manifest chunks', () => {
  // DESIGN.md § 3.1
  const expected: [string, string, number, number][] = [
    ['01-documentos.json', 'documentos', 1, 10],
    ['02-conceitos-basicos.json', 'conceitos-basicos', 11, 58],
    ['03-biologia-coelho-lebre.json', 'biologia', 59, 104],
    ['04-biologia-raposa-javali.json', 'biologia', 105, 136],
    ['05-biologia-veado-corco.json', 'biologia', 137, 167],
    ['06-biologia-perdiz.json', 'biologia', 168, 197],
    ['07-biologia-pombos-codorniz.json', 'biologia', 198, 227],
    ['08-biologia-patos.json', 'biologia', 228, 266],
    ['09-biologia-pombos-galinhola-narcejas.json', 'biologia', 267, 303],
    ['10-biologia-tarambola-tordos.json', 'biologia', 304, 320],
    ['11-nao-cinegeticas.json', 'nao-cinegeticas', 321, 361],
    ['12-condicionamentos.json', 'condicionamentos', 362, 412],
    ['13-terrenos.json', 'terrenos', 413, 415],
    ['14-periodos-processos.json', 'periodos-processos', 416, 462],
    ['15-arco-besta.json', 'arco-besta', 463, 474],
    ['16-campos-treino.json', 'campos-treino', 475, 479],
    ['17-caes.json', 'caes', 480, 498],
    ['18-cetraria.json', 'cetraria', 499, 506],
  ];

  it('matches DESIGN.md § 3.1', () => {
    expect(manifest.chunks.map((c) => [c.file, c.section, c.from, c.to])).toEqual(expected);
  });

});

describe('manifest topics', () => {
  it('has 29 topics with unique slugs, 19 of them in Biology', () => {
    expect(manifest.topics).toHaveLength(29);
    expect(new Set(manifest.topics.map((t) => t.slug)).size).toBe(29);
    expect(manifest.topics.filter((t) => t.section === 'biologia')).toHaveLength(19);
  });


  it('uses the section slug as the topic outside Biology', () => {
    for (const s of manifest.sections.filter((x) => x.slug !== 'biologia')) {
      const topics = manifest.topics.filter((t) => t.section === s.slug);
      expect(topics.map((t) => [t.slug, t.ranges])).toEqual([[s.slug, [[s.from, s.to]]]]);
    }
  });

  it('gives perdiz and pombos-rolas their split ranges', () => {
    const ranges = (slug: string) => manifest.topics.find((t) => t.slug === slug)?.ranges;
    expect(ranges('perdiz')).toEqual([[168, 197], [267, 267]]);
    expect(ranges('pombos-rolas')).toEqual([[198, 212], [268, 279]]);
  });
});

describe('manifest images', () => {
  it('lists 15 files covering the 18 questions of DESIGN.md § 2.3', () => {
    expect(manifest.images).toHaveLength(15);
    expect(new Set(manifest.images.map((i) => i.file)).size).toBe(15);
    expect(manifest.images.flatMap((i) => i.questions).sort((a, b) => a - b)).toEqual([
      119, 143, 168, 169, 198, 228, 229, 261, 267, 268, 280, 293, 319, 320, 373, 375, 394, 397,
    ]);
  });

  it('names species photos after their question and keeps sinal.jpg once', () => {
    for (const image of manifest.images) {
      if (image.file === 'sinal.jpg') {
        expect(image).toEqual({ file: 'sinal.jpg', page: 38, index: 1, questions: [373, 375, 394, 397] });
      } else {
        expect(image.questions.map((q) => `q${q}.jpg`)).toEqual([image.file]);
      }
      expect(image.index).toBeGreaterThanOrEqual(1);
    }
  });
});
