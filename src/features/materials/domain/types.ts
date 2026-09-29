/** Theory materials (S8-02): the catalog `scripts/convert-materials.ts` writes. */
export type MaterialTopic = {
  /** URL segment, unique within its chapter. */
  slug: string;
  title: string;
  /** One or two sentences for the card and `<meta name="description">`. */
  description: string;
  subtopics: string[];
  /** v1 path under `materials/` without `.html`, for its redirect. */
  legacyPath: string;
};

/** A reference on another site (v1 grade 12 materials.json). */
export type MaterialLink = { title: string; url: string; group: string };

export type MaterialChapter = {
  slug: string;
  title: string;
  description: string;
  topics: MaterialTopic[];
  links: MaterialLink[];
};

export type MaterialGrade = {
  grade: 10 | 11 | 12;
  chapters: MaterialChapter[];
};

export type MaterialCatalog = MaterialGrade[];
