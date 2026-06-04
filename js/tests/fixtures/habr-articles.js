/**
 * Configuration for Habr test articles.
 *
 * These are the same three articles archived in the link-foundation/meta-theory repo.
 * Each entry provides article metadata for use in integration tests.
 */

export const HABR_ARTICLES = {
  '0.0.0': {
    version: '0.0.0',
    title: 'Math introduction to Deep Theory',
    url: 'https://habr.com/en/companies/deepfoundation/articles/658705/',
    language: 'en',
    expectedFigures: 12,
  },
  '0.0.1': {
    version: '0.0.1',
    title: 'Глубокая Теория Связей 0.0.1',
    titleEnglish: 'Deep Theory of Links 0.0.1',
    url: 'https://habr.com/ru/companies/deepfoundation/articles/804617/',
    language: 'ru',
    expectedFigures: 10,
  },
  '0.0.2': {
    version: '0.0.2',
    title: 'The Links Theory 0.0.2',
    url: 'https://habr.com/en/articles/895896/',
    language: 'en',
    expectedFigures: 13,
  },
};

export function getArticle(version) {
  const article = HABR_ARTICLES[version];
  if (!article) {
    throw new Error(
      `Unknown article version: ${version}. Available: ${Object.keys(HABR_ARTICLES).join(', ')}`
    );
  }
  return article;
}

export function getAllArticles() {
  return Object.values(HABR_ARTICLES);
}
