// 2248 scores. A score is an exact BigInt, since tiles have no ceiling, and it is shown short past a million:
// "1.06 unvigintillion".

/** Reads a stored score: a digit string (current saves) or a number (saves from before scores were exact). */
export function toScore(v: unknown): bigint {
  if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v);
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return BigInt(Math.floor(v));
  return 0n;
}

// Short-scale names for 10^(3i+3). Up to novemdecillion these are the everyday dictionary names; from vigintillion on
// they are built by the Conway–Wechsler system, which names any size, so a score never runs out of words.
const COMMON_ILLIONS = ['', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion',
  'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion',
  'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion'];
// The 1–9 stems as they appear in a name: m(illion), b(illion) … and n for an empty group (millinillion is 10^3003).
const SMALL = ['n', 'm', 'b', 'tr', 'quadr', 'quint', 'sext', 'sept', 'oct', 'non'];
const UNITS = ['', 'un', 'duo', 'tre', 'quattuor', 'quinqua', 'se', 'septe', 'octo', 'nove'];
// Each tens and hundreds prefix carries the marks that change the unit before it: s/x for tre and se, m/n for septe and nove.
const TENS: [string, string][] = [['', ''], ['deci', 'n'], ['viginti', 'ms'], ['triginta', 'ns'], ['quadraginta', 'ns'],
  ['quinquaginta', 'ns'], ['sexaginta', 'n'], ['septuaginta', 'n'], ['octoginta', 'mx'], ['nonaginta', '']];
const HUNDREDS: [string, string][] = [['', ''], ['centi', 'nx'], ['ducenti', 'n'], ['trecenti', 'ns'], ['quadringenti', 'ns'],
  ['quingenti', 'ns'], ['sescenti', 'n'], ['septingenti', 'n'], ['octingenti', 'mx'], ['nongenti', '']];

/** One group of three digits as "…illi", e.g. 20 → vigintilli. Parts are joined with `sep`. */
function groupStem(n: number, sep: string): string {
  if (n < 10) return SMALL[n] + 'illi';
  const u = n % 10, t = Math.floor(n / 10) % 10, h = Math.floor(n / 100);
  const marks = t ? TENS[t][1] : HUNDREDS[h][1];
  let unit = UNITS[u];
  if (u === 3 && /[sx]/.test(marks)) unit = 'tres';
  else if (u === 6 && marks.includes('x')) unit = 'sex';
  else if (u === 6 && marks.includes('s')) unit = 'ses';
  else if ((u === 7 || u === 9) && marks.includes('m')) unit += 'm';
  else if ((u === 7 || u === 9) && marks.includes('n')) unit += 'n';
  return [unit, TENS[t][0], HUNDREDS[h][0]].filter(Boolean).join(sep).slice(0, -1) + 'illi';
}

/** Name of 10^(3i+3): 1 is million, 21 is unvigintillion, 100 is centillion, 1000 is millinillion. With `breakable`,
 *  soft hyphens sit between the name's parts so a narrow column can split it as "septem-vigintillion". */
export function illionName(i: number, breakable = false): string {
  if (i < COMMON_ILLIONS.length) return COMMON_ILLIONS[i];
  const sep = breakable ? '­' : '';
  const groups: number[] = [];
  for (let n = i; n > 0; n = Math.floor(n / 1000)) groups.unshift(n % 1000);
  return groups.map((g) => groupStem(g, sep)).join(sep).slice(0, -1) + 'ion'; // …illi → …illion
}

const exactFormat = new Intl.NumberFormat();

/** A score split into its number and its name: 1,234 stays exact, a million on reads "1.23" "million", three
 *  significant figures. */
export function scoreParts(score: bigint, breakable = false): { num: string; unit: string } {
  if (score < 1_000_000n) return { num: exactFormat.format(Number(score)), unit: '' };
  const digits = score.toString();
  let i = Math.floor((digits.length - 1) / 3) - 1;
  const lead = digits.length - 3 * (i + 1); // 1 to 3 digits before the point
  let m = Number(`${digits.slice(0, lead)}.${digits.slice(lead, lead + 4)}`);
  if (Number(m.toPrecision(3)) >= 1000) { i++; m /= 1000; } // 999.6 million rounds up to 1.00 billion
  const places = m < 10 ? 2 : m < 100 ? 1 : 0;
  const num = m.toLocaleString(undefined, { minimumFractionDigits: places, maximumFractionDigits: places });
  return { num, unit: illionName(i, breakable) };
}

/** The score as one line of text: "1,234" or "1.06 unvigintillion". */
export function formatScore(score: bigint): string {
  const { num, unit } = scoreParts(score);
  return unit ? `${num} ${unit}` : num;
}
