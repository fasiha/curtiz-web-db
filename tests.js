require("fake-indexeddb/auto");

const test = require('tape');
const web = require('./index');
const db = web.setup('t');

test('deleteDb', async t => {
  var s = `## @ hi @ there
## @ ola @ senora
`;
  var graph = await web.initialize(db, s);
  var quizKeys = [...graph.nodes.keys()];
  t.ok(quizKeys.length > 0, 'some keys exist');

  const graph2EbisuKeys = graph => [...graph.ebisus.keys()];
  t.equal(graph2EbisuKeys(graph).length, 0, 'no ebisus yet');
  t.equal((await web.summarizeDb(db)).length, 0, 'no db entries yet');

  await web.learnQuizzes(db, [quizKeys[0]], graph);
  t.ok(graph2EbisuKeys(graph).length > 0, 'something in ebisus');
  t.ok((await web.summarizeDb(db)).length > 1, 'at least two db entries, one the ebisu and one the event');

  await web.deleteDb(db);
  t.ok(graph2EbisuKeys(graph).length > 0, 'ebisus still there');
  t.equal((await web.summarizeDb(db)).length, 0, 'but no db entries again');

  t.end();
});