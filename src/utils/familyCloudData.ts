/** JSON omits undefined, but merge writes need an explicit null to clear a parent. */
export function serializeFamilyForCloud(family: Record<string, any>): Record<string, any> {
  const data = JSON.parse(JSON.stringify(family));
  for (const field of ['husbandId', 'wifeId']) {
    if (Object.hasOwn(family, field) && family[field] == null) data[field] = null;
  }
  return data;
}
