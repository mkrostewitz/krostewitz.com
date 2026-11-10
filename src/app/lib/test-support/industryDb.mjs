export function industryDb(initial = {}) {
  const collections = new Map(Object.entries(initial).map(([name, rows]) => [name, new Map(rows.map(row => [row._id, structuredClone(row)]))]));
  return {collections, collection(name) {
    if (!collections.has(name)) collections.set(name, new Map());
    const rows = collections.get(name);
    return {
      find() { const cursor = {sort: () => cursor, toArray: async () => structuredClone([...rows.values()])}; return cursor; },
      async findOne(filter) {
        return structuredClone([...rows.values()].find(row => Object.entries(filter).every(([key, value]) => {
          const actual = key.split('.').reduce((item, part) => item?.[part], row);
          return Array.isArray(actual) ? actual.includes(value) : actual === value;
        })) || null);
      },
      async deleteOne(filter) {
        const row = rows.get(filter._id);
        if (!row || Object.entries(filter).some(([key, value]) => row[key] !== value)) return {deletedCount: 0};
        rows.delete(filter._id);
        return {deletedCount: 1};
      },
      async updateOne(filter, update, options = {}) {
        let row = rows.get(filter._id);
        if (row && Object.entries(filter).some(([key, value]) => row[key] !== value)) return {matchedCount: 0};
        const matchedCount = row ? 1 : 0;
        if (!row && !options.upsert) return {matchedCount: 0};
        if (!row) {row = {_id: filter._id, ...structuredClone(update.$setOnInsert)}; rows.set(filter._id, row);}
        Object.assign(row, structuredClone(update.$set || {}));
        for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + value;
        return {matchedCount};
      },
    };
  }};
}
