import { describe, expect, test } from 'vitest';
import { aliasKey, expandWords, findExercise } from './exerciseAliases';

/** Asserts every name reads as the same exercise. */
function expectSame(...names: string[]) {
  const keys = names.map(aliasKey);
  for (const key of keys) expect(key).toBe(keys[0]);
}

describe('aliasKey', () => {
  test('expands the everyday equipment and lift abbreviations', () => {
    expectSame('DB RDL', 'Dumbbell Romanian Deadlift');
    expectSame('BB Row', 'Barbell Row');
    expectSame('SA DB Row', 'Single-Arm Dumbbell Row');
    expectSame('SL RDL', 'Single Leg Romanian Deadlift');
  });

  test('reads OHP on its own and with an equipment prefix', () => {
    expectSame('OHP', 'Overhead Press');
    expectSame('DB OHP', 'Dumbbell OHP', 'Dumbbell Overhead Press', 'dumbbell over-head presses');
    expectSame('BB OHP', 'Barbell Overhead Press');
  });

  test('expands the wider gym shorthand', () => {
    expectSame('KB Swing', 'KBS', 'Kettlebell Swings');
    expectSame('CG BP', 'Close-Grip Bench Press');
    expectSame('Inc DB Press', 'Incl DB Press', 'Incline Dumbbell Press');
    expectSame('BSS', 'Bulgarian Split Squat');
    expectSame('TTB', 'T2B', 'Toes to Bar', 'Toes-to-bar');
    expectSame('HSPU', 'Handstand Push-Up');
    expectSame('SLDL', 'Stiff Leg Deadlift');
  });

  test('reads C&J, an ampersand and "and" alike', () => {
    expectSame('C&J', 'Clean & Jerk', 'Clean and Jerk');
  });

  test('does not double a word an expansion already carries', () => {
    expectSame('EZ Curl', 'EZ-Bar Curl', 'EZ Bar Curl');
  });

  test('ignores hyphens, spacing inside a word and plurals', () => {
    expectSame('push ups', 'pushups', 'Push-Up', 'Push Up');
    expectSame('Dead lift', 'Deadlift');
    expectSame("Farmer's Carry", 'Farmers carry');
  });

  test('reads an anatomical name as the lift it describes', () => {
    expectSame('Shoulder Abduction', 'Lateral Raise');
    expectSame('DB Shoulder Abduction', 'Dumbbell Lateral Raise');
    expectSame('Shoulder Flexion', 'Front Raise');
    expectSame('Shoulder Horizontal Abduction', 'Rear Delt Fly');
    expectSame('Elbow Flexion', 'Bicep Curl');
    expectSame('Elbow Extension', 'Tricep Extension');
    expectSame('Knee Extension', 'Leg Extension');
    expectSame('Knee Flexion', 'Leg Curl');
    expectSame('Plantar Flexion', 'Calf Raise');
    expectSame('Hip Abduction', 'Abductor Machine', 'Hip Abduction Machine', 'Abductor');
    expectSame('Hip Adduction', 'Adductor Machine');
  });

  test('reads another name for the same lift', () => {
    expectSame('Military Press', 'Shoulder Press', 'OHP');
    expectSame('Barbell Shoulder Press', 'BB OHP');
    expectSame('Lying Hamstring Curl', 'Lying Leg Curl');
    expectSame('Quad Extension', 'Leg Extension');
    expectSame('Standing Heel Raises', 'Standing Calf Raise');
    expectSame('Side Raise', 'Side Lateral Raise', 'Lat Raise', 'Lateral Raise');
    expectSame('Reverse Fly', 'Rear Fly', 'Rear Delt Raise', 'Rear Delt Fly');
    expectSame('Lying Triceps Extensions', 'Skull Crushers');
    expectSame('Neutral-Grip Curl', 'Hammer Curl');
    expectSame('Scott Curl', 'Preacher Curl');
    expectSame("Farmer's Walk", "Farmer's Carry");
    expectSame('Hyperextension', 'Back Extension');
    expectSame('Australian Pull-Ups', 'Body Row', 'Inverted Row');
    expectSame('RFESS', 'Rear-Foot-Elevated Split Squat', 'BSS');
    expectSame('Stiff-Legged Deadlift', 'SLDL');
  });

  test('reads other spellings of equipment and movements', () => {
    expectSame('Hex Bar Deadlift', 'Trap Bar Deadlift', 'TB Deadlift');
    expectSame('Dumbbell Flyes', 'Dumbbell Flies', 'DB Fly');
    expectSame('Dumbell Row', 'DB Row');
    expectSame('Tricep Pressdown', 'Triceps Pushdown');
  });
});

describe('expandWords', () => {
  test('keeps a word that only looks plural', () => {
    expect(expandWords('Bench Press')).toEqual(['bench', 'press']);
  });

  test('drops -es where the plural added it', () => {
    expect(expandWords('Presses')).toEqual(['press']);
    expect(expandWords('Crunches')).toEqual(['crunch']);
  });

  test('prefers an alias over reading the word as a plural', () => {
    expect(expandWords('KBS')).toEqual(['kettlebell', 'swing']);
    expect(expandWords('DBs')).toEqual(['dumbbell']);
  });

  test('only expands whole words', () => {
    expect(expandWords('Sandbag Carry')).toEqual(['sandbag', 'carry']);
  });

  test('leaves ambiguous shorthand alone', () => {
    expect(expandWords('PU')).toEqual(['pu']);
    expect(expandWords('Lat Pulldown')).toEqual(['lat', 'pulldown']);
  });

  test('only replaces a phrase when every word of it is there', () => {
    expect(expandWords('Knee Raise')).toEqual(['knee', 'raise']);
    expect(expandWords('Shoulder Shrug')).toEqual(['shoulder', 'shrug']);
  });
});

describe('findExercise', () => {
  const rdl = { id: 'a', name: 'Dumbbell Romanian Deadlift' };
  const squat = { id: 'b', name: 'Back Squat' };

  test('finds an exercise by name, ignoring case and whitespace', () => {
    expect(findExercise('  back squat ', [rdl, squat])).toBe(squat);
  });

  test('finds an exercise through an alias', () => {
    expect(findExercise('DB RDL', [rdl, squat])).toBe(rdl);
  });

  test('returns undefined when nothing matches', () => {
    expect(findExercise('Front Squat', [rdl, squat])).toBeUndefined();
  });

  test('prefers the exact name over an alias match', () => {
    const long = { id: 'c', name: 'Dumbbell Row' };
    const short = { id: 'd', name: 'DB Row' };
    expect(findExercise('DB Row', [long, short])).toBe(short);
    expect(findExercise('Dumbbell Row', [short, long])).toBe(long);
  });

  test('takes the first of two exercises an alias reads the same', () => {
    const long = { id: 'c', name: 'Dumbbell Row' };
    const short = { id: 'd', name: 'DB Row' };
    expect(findExercise('dumbbell rows', [short, long])).toBe(short);
  });
});
