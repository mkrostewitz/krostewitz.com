import {initialTimelineDates, validTimelineDate, timelineDateInput} from './timelineDates.mjs';
import {resolveIndustryIcon} from './industryIcons.mjs';
import {getIndustries, createIndustry} from './industryStorage.mjs';
import {formatCategoryLabel} from './contactCategories.mjs';

// ISO 3166-1 alpha-2; names are localized by Intl.DisplayNames.
const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
export const classificationKey = value => formatCategoryLabel(value).toLowerCase();
export function countryOptions(language = 'en') {
  const names = new Intl.DisplayNames([language], {type: 'region'});
  return COUNTRY_CODES.map(id => ({id, label: names.of(id)})).sort((a, b) => a.label.localeCompare(b.label));
}
export function normalizeClassifications(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Experience classifications.');
  return Object.fromEntries(['industries', 'competencies', 'countries'].map(field => {
    const ids = value[field] ?? [];
    if (!Array.isArray(ids) || ids.length > 50 || ids.some(id => typeof id !== 'string' || !id.trim() || id.length > 100)) throw new Error(`Choose at most 50 valid ${field}.`);
    if (field === 'countries' && ids.some(id => !COUNTRY_CODES.includes(id))) throw new Error('Choose countries from the ISO country list.');
    return [field, [...new Set(ids)]];
  }));
}
export async function getExperienceCatalog(db) {
  const [industries, skills] = await Promise.all([
    getIndustries(db),
    db.collection('skills').find({$or: [{type: 'skill'}, {type: {$exists: false}, _id: {$ne: '__skills_meta'}}]}).sort({order: 1}).toArray(),
  ]);
  return {
    industries,
    competencies: skills.map(row => ({id: String(row._id), label: row.translations?.en?.label || row.label || String(row._id), translations: row.translations})),
    countries: countryOptions(),
  };
}
export async function resolveExperienceIndustry(db, input) {
  const {id, label} = await createIndustry(db, input);
  return {id, label};
}
export function validateExperienceReferences(entries, catalog) {
  for (const entry of entries) {
    for (const [field, ids] of Object.entries(entry.classifications || {})) {
      const valid = new Set(catalog[field].map(item => item.id));
      if (ids.some(id => !valid.has(id))) throw new Error(`An assigned ${field} value no longer exists. Reload the catalog and review the selection.`);
    }
  }
}
export function countryCompanies(entries, country, language = 'en') {
  const companies = entries.filter(entry => entry.classifications?.countries?.includes(country)).map(entry =>
    (entry.translations?.[language]?.company || entry.translations?.en?.company ||
      Object.values(entry.translations || {}).find(value => value.company)?.company || '').trim()
  ).filter(Boolean);
  return [...new Map(companies.map(company => [company.toLocaleLowerCase(), company])).values()];
}

export function experienceSummary(entries, catalog, language = 'en') {
  const industryCoverage = new Map(assignmentCoverage(entries, catalog.industries, new Date(), language, 'industries').map(item => [item.id, item.days]));
  const rankedIndustries = [...catalog.industries].sort((a, b) => industryCoverage.get(b.id) - industryCoverage.get(a.id));
  return Object.fromEntries(['industries', 'competencies', 'countries'].map(field => {
    const ids = new Set(entries.flatMap(entry => entry.classifications?.[field] || []));
    const options = field === 'countries' ? countryOptions(language) : field === 'industries' ? rankedIndustries : catalog[field];
    return [field, options.filter(item => ids.has(item.id)).map(item => ({id: item.id, label: item.translations?.[language]?.label || item.label, ...(field === 'countries' ? {companies: countryCompanies(entries, item.id, language)} : {}), ...(field === 'industries' ? {detail: item.translations?.[language]?.detail || item.translations?.en?.detail || '', icon: resolveIndustryIcon(item)} : {})}))];
  }));
}

// Sum the union of dated intervals, so concurrent roles never double-count time.
function coveredDays(intervals) {
  let end = -Infinity;
  let days = 0;
  for (const [start, stop] of [...intervals].sort((a, b) => a[0] - b[0])) {
    days += Math.max(0, stop - Math.max(start, end)) / 86400000;
    end = Math.max(end, stop);
  }
  return days;
}

export function skillAssignmentCoverage(entries, skills, now = new Date(), language = 'en') {
  return assignmentCoverage(entries, skills, now, language, 'competencies');
}

function assignmentCoverage(entries, skills, now, language, field) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 86400000;
  const datedEntries = entries.flatMap(entry => {
    const {startDate, endDate, current} = initialTimelineDates(entry);
    if (!validTimelineDate(startDate) || (!current && !validTimelineDate(endDate))) return [];
    const start = Date.parse(`${timelineDateInput(startDate)}T00:00:00Z`);
    let end = today;
    if (!current) {
      const date = new Date(`${timelineDateInput(endDate)}T00:00:00Z`);
      // Month-only dates include the whole final month; exact dates include the final day.
      if (endDate.length === 7) date.setUTCMonth(date.getUTCMonth() + 1);
      else date.setUTCDate(date.getUTCDate() + 1);
      end = Math.min(date.getTime(), today);
    }
    return end > start ? [{entry, interval: [start, end]}] : [];
  });
  const totalDays = coveredDays(datedEntries.map(item => item.interval));
  return skills.map(skill => {
    const matching = datedEntries.filter(({entry}) => entry.classifications?.[field]?.includes(skill.id));
    const days = coveredDays(matching.map(item => item.interval));
    const engagements = entries.filter(entry => entry.classifications?.[field]?.includes(skill.id));
    const companies = [...new Map(engagements.map(entry => {
      const company = (entry.translations?.[language]?.company || entry.translations?.en?.company || Object.values(entry.translations || {}).find(value => value.company)?.company || '').trim();
      return [company.toLocaleLowerCase(), company];
    }).filter(([, company]) => company)).values()];
    return {id: skill.id, days, totalDays, years: days / 365.2425, percentage: totalDays ? days / totalDays * 100 : 0,
      engagementPercentage: entries.length ? engagements.length / entries.length * 100 : 0, companies};
  });
}
