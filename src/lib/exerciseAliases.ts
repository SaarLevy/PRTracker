/**
 * Gym shorthand, keyed by the whole word it stands for.
 *
 * Only whole words expand, so "sa" is single-arm while "sandbag" stays a sandbag. Ambiguous
 * shorthand stays out: PU is a pull-up to some and a push-up to others, and "lat" alone would turn
 * Lat Pulldown into a lateral one (the phrase "lat raise" is safe, see `PHRASES`). SL is
 * single-leg; a stiff-leg deadlift has to say SLDL.
 * A Map rather than a plain object, so a word like "constructor" cannot hit the prototype.
 */
const ALIASES = new Map<string, string>(
  Object.entries({
    // Equipment
    db: 'dumbbell',
    dumbell: 'dumbbell',
    bb: 'barbell',
    kb: 'kettlebell',
    ez: 'ez bar',
    ssb: 'safety bar',
    tb: 'trap bar',
    hex: 'trap',
    sm: 'smith machine',
    mb: 'medicine ball',
    med: 'medicine',
    lm: 'landmine',
    bw: 'bodyweight',
    abductor: 'abductor machine',
    adductor: 'adductor machine',

    // Side, grip and angle
    sa: 'single arm',
    sl: 'single leg',
    legged: 'leg',
    cg: 'close grip',
    wg: 'wide grip',
    inc: 'incline',
    incl: 'incline',
    dec: 'decline',
    alt: 'alternating',
    bo: 'bent over',
    ext: 'extension',
    tri: 'tricep',

    // Lifts
    rdl: 'romanian deadlift',
    ohp: 'overhead press',
    bp: 'bench press',
    dl: 'deadlift',
    sldl: 'stiff leg deadlift',
    sq: 'squat',
    fs: 'front squat',
    bss: 'bulgarian split squat',
    rfess: 'rear foot elevated split squat',
    ohs: 'overhead squat',
    pp: 'push press',
    ht: 'hip thrust',
    ghr: 'glute ham raise',
    gm: 'good morning',
    hlr: 'hanging leg raise',
    flye: 'fly',
    pressdown: 'pushdown',
    hyperextension: 'back extension',

    // CrossFit
    ttb: 'toes to bar',
    t2b: 'toes to bar',
    k2e: 'knees to elbows',
    c2b: 'chest to bar',
    hspu: 'handstand push up',
    'c&j': 'clean and jerk',
    '&': 'and',
    pc: 'power clean',
    hc: 'hang clean',
    kbs: 'kettlebell swing',
    tgu: 'turkish get up',
    mu: 'muscle up',
  }),
);

/**
 * Other names for a lift, keyed by the words they replace once shorthand is spelled out.
 *
 * Keys are written the way `expandWords` leaves them (lowercase, singular, shorthand expanded),
 * which is what lets "DB Shoulder Abduction" become a dumbbell lateral raise. A phrase only
 * matches as a whole, so "lat raise" is safe where "lat" alone is not.
 */
const PHRASES = new Map<string, string>(
  Object.entries({
    // Anatomical names
    'shoulder abduction': 'lateral raise',
    'shoulder flexion': 'front raise',
    'shoulder horizontal abduction': 'rear delt fly',
    'elbow flexion': 'bicep curl',
    'elbow extension': 'tricep extension',
    'knee extension': 'leg extension',
    'knee flexion': 'leg curl',
    'plantar flexion': 'calf raise',
    'hip abduction': 'abductor machine',
    'hip adduction': 'adductor machine',

    // Same lift, other name
    'military press': 'overhead press',
    'shoulder press': 'overhead press',
    'hamstring curl': 'leg curl',
    'quad extension': 'leg extension',
    'heel raise': 'calf raise',
    'side lateral raise': 'lateral raise',
    'side raise': 'lateral raise',
    'lat raise': 'lateral raise',
    'reverse fly': 'rear delt fly',
    'rear fly': 'rear delt fly',
    'rear delt raise': 'rear delt fly',
    'lying tricep extension': 'skull crusher',
    'neutral grip curl': 'hammer curl',
    'scott curl': 'preacher curl',
    'farmer walk': 'farmer carry',
    'australian pull up': 'inverted row',
    'body row': 'inverted row',
    'rear foot elevated split squat': 'bulgarian split squat',
  }),
);

const LONGEST_PHRASE = Math.max(...[...PHRASES.keys()].map((phrase) => phrase.split(' ').length));

/** Swaps each phrase for its replacement, longest first, in one left-to-right pass. */
function replacePhrases(words: string[]): string[] {
  const result: string[] = [];
  let index = 0;
  outer: while (index < words.length) {
    for (let length = Math.min(LONGEST_PHRASE, words.length - index); length >= 2; length--) {
      const replacement = PHRASES.get(words.slice(index, index + length).join(' '));
      if (replacement) {
        result.push(...replacement.split(' '));
        index += length;
        continue outer;
      }
    }
    result.push(words[index]);
    index += 1;
  }
  return result;
}

/**
 * A word without its plural ending, close enough that both sides of a comparison agree.
 *
 * It only has to be consistent, not correct English: "atlas" becoming "atla" is harmless as long
 * as every name containing it goes through here too.
 */
function singular(word: string): string {
  if (word.length <= 2) return word;
  if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y`;
  if (/(?:ss|ch|sh|x)es$/.test(word)) return word.slice(0, -2);
  if (/(?:ss|us|is)$/.test(word)) return word;
  return word.endsWith('s') ? word.slice(0, -1) : word;
}

/**
 * The words of an exercise name with shorthand spelled out, lowercased and singular.
 *
 * A word is looked up as written before it is read as a plural, so KBS stays a kettlebell swing
 * rather than becoming several kettlebells. Phrases are swapped after that, so they see spelled-out
 * words. A repeated word is dropped last, so "EZ-Bar Curl" does not come out as "ez bar bar curl"
 * once EZ has expanded, nor "Hip Abduction Machine" as "abductor machine machine".
 */
export function expandWords(name: string): string[] {
  const words: string[] = [];
  for (const raw of name.toLowerCase().split(/[\s\-_/]+/)) {
    const token = raw.replace(/[^a-z0-9&]/g, '');
    if (!token) continue;
    const expansion = ALIASES.get(token) ?? ALIASES.get(singular(token));
    words.push(...(expansion ? expansion.split(' ').map(singular) : [singular(token)]));
  }
  return replacePhrases(words).filter((word, index, all) => word !== all[index - 1]);
}

/**
 * The key two names are the same exercise by: "DB OHP" and "Dumbbell Overhead Presses" agree.
 *
 * Words are joined without spaces so the way a word is split stops mattering: "push ups",
 * "pushups" and "Push-Up" all come out as "pushup".
 */
export function aliasKey(name: string): string {
  return expandWords(name).join('');
}

/**
 * The tracked exercise a name refers to, if any.
 *
 * The name as written wins over an alias match, so two exercises that were tracked separately
 * before aliases existed ("DB Row" and "Dumbbell Row") each keep getting their own sets. When only
 * an alias matches, the first in the list wins.
 */
export function findExercise<T extends { name: string }>(name: string, exercises: readonly T[]): T | undefined {
  const exact = name.trim().toLowerCase();
  const key = aliasKey(name);
  return (
    exercises.find((exercise) => exercise.name.trim().toLowerCase() === exact) ??
    (key ? exercises.find((exercise) => aliasKey(exercise.name) === key) : undefined)
  );
}
