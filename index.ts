import {AbstractIterator} from 'abstract-leveldown';
import * as parse from 'curtiz-parse-markdown';
import * as quiz from 'curtiz-quiz-planner';
import leveljs from 'level-js';
import level, {LevelUp} from 'levelup';

type Db = LevelUp<leveljs, AbstractIterator<any, any>>;
export const EBISU_PREFIX = 'ebisus/';
export const EVENT_PREFIX = 'events/';
const PUT = 'put' as const ;
const DEL = 'del' as const ;

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
                           opts: quiz.UpdateQuizOpts&{eventData?: any} = {}) {
  const date = opts.date || new Date();
  const batch: {type: typeof PUT, key: string, value: any}[] = [];
  function callback(key: string, ebisu: quiz.ebisu.Ebisu) {
    // Store the new value
    batch.push({type: PUT, key: EBISU_PREFIX + key, value: ebisu});
    // Log the event
    const uid = `${date.toISOString()}-${Math.random().toString(36).slice(2)}`;
    batch.push({
      type: PUT,
      key: EVENT_PREFIX + uid,
      value: {uid, key, action: 'update', result, ebisu, eventData: opts.eventData}
    });
  }
  quiz.updateQuiz(result, key, args, {date, callback});
  return db.batch(batch);
}

export function learnQuizzes(db: Db, keys: string[], args: quiz.KeyToEbisu, opts: quiz.LearnQuizOpts = {}) {
  const date = opts.date || new Date();
  let ops = Array.from(keys, (key, idx) => {
    quiz.learnQuiz(key, args, {...opts, date});
    const uid = `${date.toISOString()}-${idx}-${Math.random().toString(36).slice(2)}`;
    const ebisu = args.ebisus.get(key);
    return [
      {type: PUT, key: EVENT_PREFIX + uid, value: {uid, opts, key, action: 'learn', ebisu}},
      {type: PUT, key: EBISU_PREFIX + key, value: ebisu},
    ];
  })
  return db.batch(flat1(ops));
}

export function unlearnQuizzes(db: Db, keys: string[], args: quiz.KeyToEbisu) {
  const date = new Date();
  let ops = Array.from(keys, (key, idx) => {
    args.ebisus.delete(key);
    const uid = `${date.toISOString()}-${idx}-${Math.random().toString(36).slice(2)}`;
    return [
      {type: PUT, key: EVENT_PREFIX + uid, value: {uid, key, action: 'unlearn'}},
      {type: DEL, key: EBISU_PREFIX + key},
    ];
  })
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
