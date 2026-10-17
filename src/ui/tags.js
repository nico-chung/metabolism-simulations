const TAG_LIMIT = 3;

// A tag follows one atom (persistentId), one electron (electronId), or waits
// on a carbon for the electrons that will be taken from it (pairAtom).
export function tagKey(tag) {
  if (tag.electronId) return `e:${tag.electronId}`;
  if (tag.pairAtom) return `q:${tag.pairAtom}`;
  if (tag.persistentId) return `p:${tag.persistentId}`;
  return `${tag.instanceId}:${tag.atomId}`;
}

function lowestFree(tags) {
  const used = new Set(tags.map((tag) => tag.n));
  let n = 1;
  while (used.has(n)) n += 1;
  return n;
}

// Clicking a tagged atom clears it. A fourth tag drops the oldest.
// Numbers stay with the tags that keep them; the new tag takes the lowest free number.
export function toggleTag(tags, hit) {
  const key = tagKey(hit);
  const index = tags.findIndex((tag) => tagKey(tag) === key);
  if (index >= 0) {
    const next = tags.filter((_, i) => i !== index);
    const last = next.at(-1);
    return { tags: next, focus: last ? tagKey(last) : null };
  }
  const kept = tags.length >= TAG_LIMIT ? tags.slice(1) : tags.slice();
  const tag = { ...hit, n: lowestFree(kept) };
  return { tags: [...kept, tag], focus: tagKey(tag) };
}

// Replaces one tag with others, keeping its number for the first. Used when
// a waiting electron tag finds its electrons, or a followed hydrogen hands
// its electrons on.
export function replaceTag(tags, oldKey, replacements) {
  const index = tags.findIndex((tag) => tagKey(tag) === oldKey);
  if (index < 0) return { tags, focus: null };
  const old = tags[index];
  const rest = tags.filter((_, i) => i !== index);
  const added = [];
  replacements.forEach((replacement, i) => {
    if (i > 0 && rest.length + added.length >= TAG_LIMIT) return;
    const n = i === 0 ? old.n : lowestFree([...rest, ...added]);
    added.push({ ...replacement, n });
  });
  const next = [...rest.slice(0, index), ...added, ...rest.slice(index)];
  return { tags: next, focus: added[0] ? tagKey(added[0]) : null };
}
