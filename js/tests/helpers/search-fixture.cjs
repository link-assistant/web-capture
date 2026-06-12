const nock = require('nock');

nock('https://en.wikipedia.org')
  .persist()
  .get('/w/rest.php/v1/search/page')
  .query(true)
  .reply(200, {
    pages: [
      {
        id: 1,
        key: 'Formal_methods',
        title: 'Formal methods',
        excerpt: 'the study of <b>formal</b> methods',
        description: 'rigorous techniques',
      },
    ],
  });
