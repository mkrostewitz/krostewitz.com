export const POST_CATEGORIES_COLLECTION = "postCategories";

// The normalized slug is MongoDB's unique primary key. Keep the first label
// so subsequent posts reuse the same spelling, including concurrent saves.
export async function registerPostCategories(db, categories) {
  const collection = db.collection(POST_CATEGORIES_COLLECTION);
  return Promise.all(categories.map(async ({label, slug}) => {
    try {
      await collection.updateOne(
        {_id: slug},
        {$setOnInsert: {label, slug, createdAt: new Date()}},
        {upsert: true}
      );
    } catch (error) {
      // Another request may have inserted the same category first.
      if (error.code !== 11000) throw error;
    }

    const stored = await collection.findOne({_id: slug});
    if (!stored) throw new Error("Unable to save post category.");
    return {label: stored.label, slug: stored.slug};
  }));
}
