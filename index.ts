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
    db.createReadStream({gt: EBISU_PREFIX, lt: EBISU_PREFIX + '\xff', valueAsBuffer: false, keyAsBuffer: false})
        .on('data', ({key, value}) => ebisus.set(key.slice(EBISU_PREFIX.length), rehydrateEbisu(value)))
        .on('close', () => resolve({ebisus}))
        .on('error', err => reject(err));
  });
}
export async function initialize(db: Db, md: string): Promise<parse.QuizGraph&quiz.KeyToEbisu> {
  return {...parse.textToGraph(md), ...await loadEbisus(db)};
}
export function updateQuiz(db: Db, result: boolean, key: string, args: quiz.KeyToEbisu&parse.QuizGraph,
                           {date}: quiz.UpdateQuizOpts) {
  date = date || new Date();
  const batch: {type: typeof PUT, key: string, value: any}[] = [];
  function callback(key: string, ebisu: quiz.ebisu.Ebisu) {
    batch.push({type: PUT, key: EBISU_PREFIX + key, value: ebisu});
    batch.push({type: PUT, key: EVENT_PREFIX + (date as Date).toISOString(), value: {result, ebisu}});
  }
  quiz.updateQuiz(result, key, args, {date, callback});
  return db.batch(batch);
}

export function learnQuizzes(db: Db, keys: string[]|IterableIterator<string>, args: quiz.KeyToEbisu, date?: Date,
                             opts: {halflifeScale?: number, halflifeScales?: number[], alphaBeta?: number} = {}) {
  date = date || new Date();
  quiz.learnQuizzes(keys, args, {date});
  const prefixEv = EVENT_PREFIX + date.toISOString() + '-';
  let ops =
      Array.from(keys, (key, idx) => [{type: PUT, key: prefixEv + idx, value: {opts, ebisu: args.ebisus.get(key)}},
                                      {type: PUT, key: EBISU_PREFIX + key, value: args.ebisus.get(key)}])
  return db.batch(flat1(ops));
}

export function summarizeDb(db: Db) {
  let res: any[] = [];
  return new Promise((resolve, reject) => {
    db.createReadStream({valueAsBuffer: false, keyAsBuffer: false})
        .on('data', x => res.push(x))
        .on('close', () => resolve(res))
        .on('error', err => reject(err));
  });
}
