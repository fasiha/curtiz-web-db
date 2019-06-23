import {AbstractIterator} from 'abstract-leveldown';
import * as parse from 'curtiz-parse-markdown';
import * as quiz from 'curtiz-quiz-planner';
import leveljs from 'level-js';
import level, {LevelUp} from 'levelup';

type Db = LevelUp<leveljs, AbstractIterator<any, any>>;
const EBISU_PREFIX = 'ebisus/';
const EVENT_PREFIX = 'events/';
const PUT: 'put' = 'put';

function flat1<T>(v: T[][]) { return v.reduce((memo, curr) => memo.concat(curr), [] as T[]); }
function rehydrateEbisu(nominalEbisu: quiz.ebisu.Ebisu) {
  if (!(nominalEbisu.lastDate instanceof Date)) { nominalEbisu.lastDate = new Date(nominalEbisu.lastDate); }
  return nominalEbisu;
}

export function setup(name: string): Db { return level(leveljs(name)) }
export function loadEbisus(db: Db): Promise<quiz.KeyToEbisu> {
  let ebisus: Map<string, any> = new Map();
  return new Promise((resolve, reject) => {
    db.createReadStream({'gt': EBISU_PREFIX, lt: EBISU_PREFIX.slice(0, -1) + '\xff'})
        .on('data', ({key, value}) => ebisus.set(key.slice(EBISU_PREFIX.length), rehydrateEbisu(value)))
        .on('close', () => resolve({ebisus}))
        .on('error', (err) => reject(err));
  });
}
export async function initialize(db: Db, md: string): Promise<parse.QuizGraph&quiz.KeyToEbisu> {
  return {...parse.textToGraph(md), ...await loadEbisus(db)};
}
export {quiz};
export {parse};
export function updateQuiz(db: Db, result: boolean, key: string, args: quiz.KeyToEbisu&parse.QuizGraph, date?: Date) {
  date = date || new Date();
  quiz.updateQuiz(result, key, args, date);
  const updatedEbisu = args.ebisus.get(key);
  return db.batch([
    {type: PUT, key: EBISU_PREFIX + key, value: updatedEbisu},
    {type: PUT, key: EVENT_PREFIX + date.toISOString(), value: {result, ebisu: updatedEbisu}}
  ]);
}

export function learnQuizzes(db: Db, keys: string[]|IterableIterator<string>, args: quiz.KeyToEbisu, date?: Date,
                             opts: {halflifeScale?: number, halflifeScales?: number[], alphaBeta?: number} = {}) {
  date = date || new Date();
  quiz.learnQuizzes(keys, args, date, opts);
  const prefixEv = EVENT_PREFIX + date.toISOString() + '-';
  let ops =
      Array.from(keys, (key, idx) => [{type: PUT, key: prefixEv + idx, value: {opts, ebisu: args.ebisus.get(key)}},
                                      {type: PUT, key: EBISU_PREFIX + key, value: args.ebisus.get(key)}])
  // console.log('learnQuiz batch', ops)
  return db.batch(flat1(ops));
}

export function summarizeDb(db: Db) {
  let res: any[] = [];
  return new Promise((resolve, reject) => {
    db.createReadStream({valueAsBuffer: false, keyAsBuffer: false})
        .on('data', x => res.push(x))
        .on('close', () => resolve(res))
        .on('error', (err) => reject(err));
  });
}

export async function test() {
  let db = setup('testing');
  let md = `## @ 千と千尋の神隠し @ せんとちひろのかみがくし
- @fill と
- @fill の
- @ 千 @ せん    @pos noun-proper-name-firstname @omit [千]と
- @ 千尋 @ ちひろ    @pos noun-proper-name-firstname
- @ 神隠し @ かみがくし    @pos noun-common-general
- @translation @en Spirited Away (film)
## @ このおはなしに出て来る人びと @ このおはなしにでてくるひとびと
- @fill に
- @fill 出て来る @ でてくる
- @ 話 @ はなし    @pos noun-common-verbal_suru @omit はなし
- @ 出る @ でる    @pos verb-general @omit 出
- @ 来る @ くる    @pos verb-bound
- @ 人々 @ ひとびと    @pos noun-common-general @omit 人びと
## @ 湯婆婆 @ ゆばーば
- @ 湯婆婆 @ ゆばーば    @pos noun-proper-name-general`;
  let graph = await initialize(db, md);
  console.log('init', await summarizeDb(db))

  let allKeys = flat1([...graph.raws.values()].map(set => [...set.values()]));
  console.log('allKeys', allKeys)
  console.log('graph', graph);

  const hl = quiz.DEFAULT_EBISU_HALFLIFE_HOURS;
  const ab = quiz.DEFAULT_EBISU_ALPHA_BETA;
  const myAlphaBeta = 3;
  const date = new Date();
  await learnQuizzes(db, allKeys.slice(0, 3), graph, date, {halflifeScale: 1.5, alphaBeta: myAlphaBeta});

  console.log('after learning', await summarizeDb(db));
  console.log('graph', graph);
}