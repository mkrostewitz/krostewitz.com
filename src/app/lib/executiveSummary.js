import 'server-only';
import {getCvTimeline} from './cvTimeline';
import {getEducation} from './education';
import {getDb} from './mongo';
import {experienceSummary, getExperienceCatalog, skillAssignmentCoverage} from './experienceClassifications.mjs';
import {localizeEducationLanguages, publicEducationEntries} from './educationData.mjs';

export async function getExecutiveSummary(language = 'en') {
  const [timeline, education, catalog] = await Promise.all([getCvTimeline(), getEducation(), getDb().then(getExperienceCatalog)]);
  return {...experienceSummary(timeline.entries, catalog, language), skillUsage: skillAssignmentCoverage(timeline.entries, catalog.competencies, new Date(), language), languages: localizeEducationLanguages(education.languages, language), education: publicEducationEntries(education.entries, language)};
}
