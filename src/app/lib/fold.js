import 'server-only';
import {getDb} from './mongo';
import {getDefaultTranslations} from './siteContent';
import {ensureFold, publicFold, saveFold} from './foldStorage.mjs';

export async function getFoldContent() {
  return publicFold(await ensureFold(await getDb(), getDefaultTranslations()));
}
export async function saveFoldContent(content, user) {
  return saveFold(await getDb(), content, user, getDefaultTranslations());
}
