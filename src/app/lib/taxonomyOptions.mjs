export function isTaxonomyOption(value) {
  return Boolean(value && typeof value === 'object' && typeof value.id === 'string' && value.id.length && typeof value.label === 'string');
}

export function taxonomyOptionLabel(value) {
  return typeof value === 'string' ? value : isTaxonomyOption(value) ? value.label : '';
}

export function taxonomyOptionsEqual(option, value) {
  // MUI can compare a highlighted option with undefined when multiple has no
  // selections. Free-solo strings also have no persistent identity yet.
  return isTaxonomyOption(option) && isTaxonomyOption(value) && option.id === value.id;
}
