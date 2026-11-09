// An explicit group can span subsidiaries with different company names.
// Groups take the position of their first role; roles keep their saved order.
export function groupTimelineRoles(timeline, expanded = true) {
  const groups = [];
  const employers = new Map();
  timeline.forEach((item, index) => {
    if (!expanded && item.showAfterMore) return;
    const label = (item.employerGroup || '').trim();
    const key = label.toLocaleLowerCase('en');
    let group = label ? employers.get(key) : null;
    if (!group) {
      group = {label, roles: []};
      groups.push(group);
      if (label) employers.set(key, group);
    }
    group.roles.push({item, index});
  });
  return groups;
}
