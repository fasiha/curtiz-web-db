"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var parse = __importStar(require("curtiz-parse-markdown"));
var quiz = __importStar(require("curtiz-quiz-planner"));
var level_js_1 = __importDefault(require("level-js"));
var levelup_1 = __importDefault(require("levelup"));
exports.EBISU_PREFIX = 'ebisus/';
exports.EVENT_PREFIX = 'events/';
var PUT = 'put';
var DEL = 'del';
function flat1(v) { return v.reduce(function (memo, curr) { return memo.concat(curr); }, []); }
function rehydrateEbisu(nominalEbisu) {
    if (!(nominalEbisu.lastDate instanceof Date)) {
        nominalEbisu.lastDate = new Date(nominalEbisu.lastDate);
    }
    return nominalEbisu;
}
function setup(name) { return levelup_1.default(level_js_1.default(name)); }
exports.setup = setup;
function loadEbisus(db) {
    var ebisus = new Map();
    return new Promise(function (resolve, reject) {
        db.createReadStream({ gt: exports.EBISU_PREFIX, lt: exports.EBISU_PREFIX + '\xff', valueAsBuffer: false, keyAsBuffer: false })
            .on('data', function (_a) {
            var key = _a.key, value = _a.value;
            return ebisus.set(key.slice(exports.EBISU_PREFIX.length), rehydrateEbisu(value));
        })
            .on('close', function () { return resolve({ ebisus: ebisus }); })
            .on('error', function (err) { return reject(err); });
    });
}
exports.loadEbisus = loadEbisus;
function initialize(db, md) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = [{}, parse.textToGraph(md)];
                    return [4 /*yield*/, loadEbisus(db)];
                case 1: return [2 /*return*/, __assign.apply(void 0, _a.concat([_b.sent()]))];
            }
        });
    });
}
exports.initialize = initialize;
function updateQuiz(db, result, key, args, opts) {
    if (opts === void 0) { opts = {}; }
    var date = opts.date || new Date();
    var batch = [];
    function callback(key, ebisu) {
        // Store the new value
        batch.push({ type: PUT, key: exports.EBISU_PREFIX + key, value: ebisu });
        // Log the event
        var uid = date.toISOString() + "-" + Math.random().toString(36).slice(2);
        var value = { uid: uid, date: date, key: key, action: 'update', result: result, ebisu: ebisu, eventData: opts.eventData };
        batch.push({ type: PUT, key: exports.EVENT_PREFIX + uid, value: value });
    }
    quiz.updateQuiz(result, key, args, { date: date, callback: callback });
    return db.batch(batch);
}
exports.updateQuiz = updateQuiz;
function learnQuizzes(db, keys, ebisusContainer, opts) {
    if (opts === void 0) { opts = {}; }
    var date = opts.date || new Date();
    var ops = Array.from(keys, function (key, idx) {
        quiz.learnQuiz(key, ebisusContainer, __assign({}, opts, { date: date }));
        var uid = date.toISOString() + "-" + idx + "-" + Math.random().toString(36).slice(2);
        var ebisu = ebisusContainer.ebisus.get(key);
        if (!ebisu) {
            throw new Error('typescript pacification: ebisu not found in graph');
        }
        var eventValue = { uid: uid, date: date, opts: opts, key: key, action: 'learn', ebisu: ebisu };
        return [
            { type: PUT, key: exports.EVENT_PREFIX + uid, value: eventValue },
            { type: PUT, key: exports.EBISU_PREFIX + key, value: ebisu },
        ];
    });
    return db.batch(flat1(ops));
}
exports.learnQuizzes = learnQuizzes;
function unlearnQuizzes(db, keys, args) {
    var date = new Date();
    var ops = Array.from(keys, function (key, idx) {
        args.ebisus.delete(key);
        var uid = date.toISOString() + "-" + idx + "-" + Math.random().toString(36).slice(2);
        var eventValue = { uid: uid, date: date, key: key, action: 'unlearn' };
        return [
            { type: PUT, key: exports.EVENT_PREFIX + uid, value: eventValue },
            { type: DEL, key: exports.EBISU_PREFIX + key },
        ];
    });
    return db.batch(flat1(ops));
}
exports.unlearnQuizzes = unlearnQuizzes;
function summarizeDb(db, opts) {
    if (opts === void 0) { opts = {}; }
    var res = [];
    return new Promise(function (resolve, reject) {
        db.createReadStream(__assign({ valueAsBuffer: false, keyAsBuffer: false }, opts))
            .on('data', function (x) { return res.push(x); })
            .on('close', function () { return resolve(res); })
            .on('error', function (err) { return reject(err); });
    });
}
exports.summarizeDb = summarizeDb;
function deleteDb(db, opts) {
    if (opts === void 0) { opts = {}; }
    var batch = db.batch();
    return new Promise(function (resolve, reject) {
        db.createKeyStream(__assign({ keyAsBuffer: false }, opts))
            .on('data', function (key) { batch = batch.del(key); })
            .on('close', function () { resolve(batch.write()); })
            .on('error', function (err) { return reject(err); });
    });
}
exports.deleteDb = deleteDb;
