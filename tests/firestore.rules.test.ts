import { writePersonDeletionMarkers } from '../src/services/personDeletionCloudService';
import { writeIgnoredDuplicateChanges } from '../src/services/ignoredDuplicateCloudService';
import { readProjectFromFirestore } from '../src/services/projectCloudReadService';
import { removeFamilyMemberships, restoreFamilyMemberships } from '../src/services/familyRestoreService';
import { serializeFamilyForCloud } from '../src/utils/familyCloudData';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, setLogLevel, updateDoc, where } from 'firebase/firestore';
import { getPublicTree, publishPublicTree } from '../src/services/publicTreeService';
import { createPublicTree, restorePublicTree } from '../src/utils/publicTree';
import type { Firestore } from 'firebase/firestore';
import type { GenealogyDatabase } from '../src/types';

setLogLevel('silent');

let env: RulesTestEnvironment;
const project = 'defaultProject';
const publicBase = 'publicTrees/share/versions/current';
const metadata = { id: 'share', schemaVersion: 1, version: 'current', enabled: true,
  rootPersonId: 'deceased', updatedAt: '2026-11-19T00:00:00Z' };
const memberId = (email: string) => email.toLowerCase().replace(/[^a-z0-9]/g, '_');
const identity = (uid: string, email = `${uid}@example.com`, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

before(async () => {
  // The demo project and explicit loopback check prevent accidental production access.
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
  env = await initializeTestEnvironment({ projectId: 'demo-my-root-cuba',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const records: Record<string, any> = {
      'projects/defaultProject': { title: 'Private tree' },
      'projects/otherProject/persons/private': { firstName: 'Other project' },
      'projects/defaultProject/persons/living': { id: 'living', isLiving: true, firstName: 'Private' },
      'projects/defaultProject/persons/deceased': { id: 'deceased', isLiving: false, notes: 'Private relatives' },
      'sharedTrees/share': { ownerUid: 'editor', database: { persons: { living: { firstName: 'Private' } } }, pinHash: 'private-pin' },
      'sharedTrees/legacy': { database: { persons: { living: { firstName: 'Private' } } } },
      'genealogyProjects/defaultProject': { persons: [{ firstName: 'Private' }] },
      'trees/legacy': { private: true },
      'publicTrees/share': metadata,
      [`${publicBase}/persons/deceased`]: { id: 'deceased', gender: 'M', isLiving: false, firstName: 'Public' },
      // Out-of-contract data is seeded with admin privileges to test read guards.
      [`${publicBase}/persons/living`]: { id: 'living', gender: 'F', isLiving: true, firstName: 'Private' },
      [`${publicBase}/families/family`]: { id: 'family', husbandId: 'deceased' },
      'publicTrees/share/versions/old/persons/deceased': { id: 'deceased', gender: 'M', isLiving: false }
    };
    for (const role of ['admin', 'editor', 'researcher', 'viewer']) {
      records[`projects/defaultProject/whitelist/${memberId(`${role}@example.com`)}`] = {
        id: `w-${role}`, email: `${role}@example.com`, role, status: 'active'
      };
    }
    records[`projects/defaultProject/whitelist/${memberId('suspended@example.com')}`] = {
      email: 'suspended@example.com', role: 'admin', status: 'suspended'
    };
    records[`projects/defaultProject/whitelist/${memberId('collision+a@example.com')}`] = {
      email: 'collision+a@example.com', role: 'admin', status: 'active'
    };
    await Promise.all(Object.entries(records).map(([path, data]) => setDoc(doc(db, path), data)));
  });
});

test('anonymous clients cannot read or mutate private collections, including legacy snapshots', async () => {
  const db = env.unauthenticatedContext().firestore();
  for (const path of ['projects/defaultProject', 'projects/defaultProject/persons/living',
    'projects/defaultProject/persons/deceased', 'projects/defaultProject/whitelist/admin_example_com',
    'projects/defaultProject/accessConfig/main', 'whitelist/admin_example_com', 'admins/admin',
    'sharedTrees/share', 'sharedTrees/legacy', 'genealogyProjects/defaultProject', 'trees/legacy', 'test/ping']) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { injected: true }));
    await assertFails(deleteDoc(doc(db, path)));
  }
  await assertFails(getDocs(collection(db, 'projects/defaultProject/persons')));
});

test('a Google account or custom admin claim alone grants no private access', async () => {
  const contexts = [identity('outsider'), identity('unverified', 'admin@example.com', false),
    env.authenticatedContext('anonymous-auth').firestore(),
    env.authenticatedContext('fake-admin', { email: 'outsider@example.com', email_verified: true, role: 'admin' }).firestore(),
    identity('collision', 'collision.a@example.com'), identity('suspended')];
  for (const db of contexts) {
    await assertFails(getDoc(doc(db, 'projects/defaultProject/persons/living')));
    await assertFails(setDoc(doc(db, 'projects/defaultProject/persons/new'), { id: 'new' }));
  }
});

for (const role of ['viewer', 'editor', 'researcher', 'admin']) {
  test(`${role}: project data follows the server-side role`, async () => {
    const db = identity(role);
    await assertSucceeds(getDoc(doc(db, 'projects/defaultProject/persons/living')));
    await assertSucceeds(getDocs(collection(db, 'projects/defaultProject/persons')));
    const write = setDoc(doc(db, 'projects/defaultProject/persons/new'), { id: 'new' });
    await (role === 'viewer' ? assertFails(write) : assertSucceeds(write));
    await assertFails(getDoc(doc(db, 'projects/otherProject/persons/private')));
    await assertFails(setDoc(doc(db, 'projects/defaultProject/unreviewed/new'), { leaked: true }));
  });
}

test('both existing owners require verified Firebase email and are scoped to defaultProject', async () => {
  for (const email of ['domagile@gmail.com', 'CubaTarara400@gmail.com']) {
    const owner = identity('owner', email);
    await assertSucceeds(getDoc(doc(owner, 'projects/defaultProject/persons/living')));
    await assertSucceeds(setDoc(doc(owner, 'projects/defaultProject/config/main'), { setting: true }));
    await assertFails(getDoc(doc(owner, 'projects/otherProject/persons/private')));
    await assertFails(getDoc(doc(identity('unverified-owner', email, false), 'projects/defaultProject/persons/living')));
  }
});

test('only admins can manage canonical whitelist entries or security configuration', async () => {
  const data = { id: 'new-member', email: 'new.member+tag@example.com', role: 'viewer', status: 'active' };
  const path = `projects/defaultProject/whitelist/${memberId(data.email)}`;
  for (const uid of ['outsider', 'viewer', 'editor', 'researcher']) {
    const db = identity(uid);
    await assertFails(setDoc(doc(db, path), data));
    await assertFails(setDoc(doc(db, 'projects/defaultProject/config/main'), { mode: 'open' }));
    await assertFails(setDoc(doc(db, 'admins/self'), { role: 'admin' }));
  }
  const admin = identity('admin');
  await assertSucceeds(setDoc(doc(admin, path), data));
  await assertSucceeds(getDoc(doc(identity('new-member', data.email), 'projects/defaultProject/persons/living')));
  await assertFails(setDoc(doc(admin, 'projects/defaultProject/whitelist/random-id'), data));
  await assertFails(setDoc(doc(admin, path), { ...data, role: 'superadmin' }));
  await assertSucceeds(updateDoc(doc(admin, path), { status: 'suspended' }));
  await assertFails(getDoc(doc(identity('new-member', data.email), 'projects/defaultProject/persons/living')));
});

test('users cannot approve their own access request or submit one for somebody else', async () => {
  const db = identity('outsider');
  const request = { email: 'outsider@example.com', status: 'pending', requestedRole: 'viewer' };
  const ref = doc(db, 'projects/defaultProject/accessRequests/mine');
  await assertSucceeds(setDoc(ref, request));
  await assertSucceeds(getDoc(ref));
  await assertFails(updateDoc(ref, { status: 'approved' }));
  await assertFails(setDoc(doc(db, 'projects/defaultProject/accessRequests/forged'), { ...request, email: 'viewer@example.com' }));
  await assertSucceeds(updateDoc(doc(identity('admin'), 'projects/defaultProject/accessRequests/mine'), { status: 'approved' }));
});

test('anonymous visitors get only deceased records from the active public version', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(db, 'publicTrees/share')));
  await assertSucceeds(getDoc(doc(db, `${publicBase}/persons/deceased`)));
  await assertFails(getDoc(doc(db, `${publicBase}/persons/living`)));
  await assertFails(getDocs(collection(db, `${publicBase}/persons`)));
  const people = await assertSucceeds(getDocs(query(collection(db, `${publicBase}/persons`), where('isLiving', '==', false))));
  assert.deepEqual(people.docs.map(person => person.id), ['deceased']);
  await assertSucceeds(getDocs(collection(db, `${publicBase}/families`)));
  await assertFails(getDocs(collection(db, 'publicTrees')));
  await assertFails(getDoc(doc(db, 'publicTrees/share/versions/old/persons/deceased')));
  await assertFails(setDoc(doc(db, `${publicBase}/persons/injected`), { id: 'injected', gender: 'M', isLiving: false }));
});

test('public publication cannot include living people, private fields or nested payloads', async () => {
  const db = identity('editor');
  const base = { id: 'new', gender: 'F', isLiving: false, firstName: 'Historical' };
  const ref = doc(db, `${publicBase}/persons/new`);
  await assertSucceeds(setDoc(ref, base));
  for (const data of [{ ...base, isLiving: true }, { ...base, notes: 'Living relatives' },
    { ...base, database: { living: true } }, { ...base, firstName: { private: true } },
    { ...base, birthYear: { private: true } }]) {
    await assertFails(setDoc(ref, data));
  }
  await assertFails(setDoc(doc(db, 'publicTrees/share'), { ...metadata, pinHash: 'secret' }));
  await assertFails(setDoc(doc(db, `${publicBase}/families/unsafe`), { id: 'unsafe', husbandId: 'living' }));
  await assertFails(setDoc(doc(db, `${publicBase}/families/unsafe`), { id: 'unsafe', notes: 'Living relatives' }));
});

test('another editor cannot overwrite somebody else’s share; a viewer cannot publish', async () => {
  const safe = { ...metadata, id: 'new-share' };
  await assertFails(setDoc(doc(identity('researcher'), 'publicTrees/share'), metadata));
  await assertFails(setDoc(doc(identity('viewer'), 'sharedTrees/new-share'), { ownerUid: 'viewer' }));
  await assertFails(setDoc(doc(identity('outsider'), 'publicTrees/new-share'), safe));
  await assertSucceeds(setDoc(doc(identity('editor'), 'sharedTrees/new-share'), { ownerUid: 'editor' }));
  await assertSucceeds(setDoc(doc(identity('editor'), 'publicTrees/new-share'), safe));
});

test('disabled and superseded public versions immediately deny person reads', async () => {
  const guest = env.unauthenticatedContext().firestore();
  const admin = identity('admin');
  await assertSucceeds(updateDoc(doc(admin, 'publicTrees/share'), { enabled: false }));
  await assertFails(getDoc(doc(guest, `${publicBase}/persons/deceased`)));
  await assertFails(getDocs(collection(guest, `${publicBase}/families`)));
  await assertSucceeds(updateDoc(doc(admin, 'publicTrees/share'), { enabled: true, version: 'replacement' }));
  await assertFails(getDoc(doc(guest, `${publicBase}/persons/deceased`)));
});

test('projection excludes living/unknown people, private fields and living family links', () => {
  const database: GenealogyDatabase = { persons: {
    dead: { id: 'dead', gender: 'M', isLiving: false, name: { given: 'Historical', surname: 'Person' },
      notes: 'Living secret', documents: [{ id: 'private', title: 'Private', url: 'private' }],
      fatherId: 'living', motherId: 'unknown' },
    dated: { id: 'dated', gender: 'F', deathYear: 1900, bio: 'Living relatives', childrenIds: ['living'] },
    living: { id: 'living', gender: 'F', isLiving: true, deathYear: 1900, firstName: 'Private' },
    unknown: { id: 'unknown', gender: 'U' },
    oldUnknown: { id: 'oldUnknown', gender: 'U', birthYear: 1700 },
    placeOnly: { id: 'placeOnly', gender: 'U', deathPlace: 'Unknown' },
    whitespace: { id: 'whitespace', gender: 'U', deathDate: '   ' },
    unknownDeath: { id: 'unknownDeath', gender: 'U', deathDate: 'невідомо' },
    futureDeath: { id: 'futureDeath', gender: 'U', deathYear: 2999 },
    deleted: { id: 'deleted', gender: 'M', isLiving: false, isDeleted: true }
  }, families: {
    family: { id: 'family', husbandId: 'dead', wifeId: 'living', notes: 'Living secret',
      children: [{ personId: 'dated' }, { personId: 'unknown' }] }
  }, sources: { private: { id: 'private', title: 'Living relative' } } };
  const original = structuredClone(database);
  const result = createPublicTree(database);
  assert.deepEqual(Object.keys(result.persons), ['dead', 'dated']);
  assert.deepEqual(result.families, { family: { id: 'family', husbandId: 'dead' } });
  assert.equal(result.persons.dead.fatherId, undefined);
  assert.equal(result.persons.dead.motherId, undefined);
  assert.equal(JSON.stringify(result).includes('Living secret'), false);
  assert.equal(JSON.stringify(result).includes('documents'), false);
  const restored = restorePublicTree(Object.values(result.persons), Object.values(result.families), 'living');
  assert.equal(restored.rootPersonId, 'dead');
  assert.deepEqual(restored.families.family.children, [{ personId: 'dated' }]);
  assert.deepEqual(restored.persons.dead.childrenIds, ['dated']);
  assert.deepEqual(restored.sources, {});
  assert.deepEqual(database, original);
});


test('publication spans write batches, reconstructs deceased-only families and revokes previous versions', { timeout: 60000 }, async () => {
  // Modular SDK functions unwrap the provided compat instance. Keep its emulator/mock-auth settings.
  const db = identity('editor') as unknown as Firestore;
  const guest = env.unauthenticatedContext().firestore() as unknown as Firestore;
  const database: GenealogyDatabase = { persons: {}, families: {}, sources: {} };
  for (let index = 0; index < 405; index++) {
    const id = `person-${index}`;
    database.persons[id] = { id, gender: index % 2 ? 'F' : 'M', isLiving: false,
      name: { given: `Historical-${index}`, surname: 'Family' }, notes: 'Private note' };
  }
  database.persons.living = { id: 'living', gender: 'F', isLiving: true, firstName: 'Private living person' };
  for (let index = 0; index < 17; index++) {
    database.families[`family-${index}`] = { id: `family-${index}`,
      husbandId: `person-${index * 3}`, wifeId: `person-${index * 3 + 1}`,
      children: [{ personId: `person-${index * 3 + 2}` }, { personId: 'living' }], notes: 'Private family note' };
  }
  await assertSucceeds(publishPublicTree(db, 'share', database, 'living'));
  const result = await assertSucceeds(getPublicTree(guest, 'share'));
  assert.equal(Object.keys(result!.database.persons).length, 405);
  assert.equal(Object.keys(result!.database.families).length, 17);
  assert.equal(JSON.stringify(result).includes('Private'), false);
  assert.equal(result!.database.persons.living, undefined);
  assert.equal(result!.database.rootPersonId, 'person-0');
  const oldMeta = (await getDoc(doc(db, 'publicTrees/share'))).data()!;
  database.persons['person-0'].isLiving = true;
  await assertSucceeds(publishPublicTree(db, 'share', database, 'person-0'));
  await assertFails(getDoc(doc(guest, `publicTrees/share/versions/${oldMeta.version}/persons/person-0`)));
  const updated = await getPublicTree(guest, 'share');
  assert.equal(updated!.database.persons['person-0'], undefined);
  assert.equal(Object.keys(updated!.database.persons).length, 404);
  assert.equal(updated!.database.families['family-0'].husbandId, undefined);
});


test('a failed public write leaves the previous version inaccessible', async () => {
  const db = identity('editor') as unknown as Firestore;
  const guest = env.unauthenticatedContext().firestore() as unknown as Firestore;
  const invalid: GenealogyDatabase = { persons: {
    invalid: { id: 'invalid', gender: 'M', isLiving: false, firstName: 'x'.repeat(513) }
  }, families: {}, sources: {} };
  await assertFails(publishPublicTree(db, 'share', invalid, 'invalid'));
  assert.equal((await getDoc(doc(db, 'publicTrees/share'))).data()!.enabled, false);
  assert.equal(await getPublicTree(guest, 'share'), null);
  await assertFails(getDoc(doc(guest, `${publicBase}/persons/deceased`)));
});

test('deletion marker transaction restores selected people while preserving unrelated markers', async () => {
  const db = identity('editor') as unknown as Firestore;
  const ref = doc(db, 'projects', project, 'systemSettings', 'deletedTombstones');
  await setDoc(ref, { ids: ['restored','keep'] });
  assert.deepEqual(await writePersonDeletionMarkers(db, project, { restored: false, added: true }), ['keep','added']);
  assert.deepEqual((await getDoc(ref)).data()!.ids, ['keep','added']);
});

test('concurrent marker transactions do not overwrite another client’s independent deletion', async () => {
  const first = identity('editor') as unknown as Firestore;
  const second = identity('researcher') as unknown as Firestore;
  const ref = doc(first, 'projects', project, 'systemSettings', 'deletedTombstones');
  await setDoc(ref, { ids: ['restored','keep'] });
  await Promise.all([
    writePersonDeletionMarkers(first, project, { restored: false }),
    writePersonDeletionMarkers(second, project, { other: true })
  ]);
  assert.deepEqual((await getDoc(ref)).data()!.ids.sort(), ['keep','other']);
});

test('viewer and anonymous clients cannot change deletion markers through the transaction helper', async () => {
  const admin = identity('admin') as unknown as Firestore;
  const ref = doc(admin, 'projects', project, 'systemSettings', 'deletedTombstones');
  await setDoc(ref, { ids: ['keep'] });
  await assertFails(writePersonDeletionMarkers(identity('viewer') as unknown as Firestore, project, { keep: false }));
  await assertFails(writePersonDeletionMarkers(env.unauthenticatedContext().firestore() as unknown as Firestore, project, { keep: false }));
  assert.deepEqual((await getDoc(ref)).data()!.ids, ['keep']);
});
test('duplicate choices patch existing keys and return a monotonic revision for stale-read protection', async () => {
  const db = identity('editor') as unknown as Firestore;
  const ref = doc(db, 'projects', project, 'systemSettings', 'ignoredDuplicates');
  await setDoc(ref, { keys: ['old___pair', 'keep___pair'] });
  const result = await writeIgnoredDuplicateChanges(db, project, [
    { key: 'old___pair', ignored: false, token: 'one' }, { key: 'new___pair', ignored: true, token: 'two' }
  ]);
  assert.equal(result.revision, 1); assert.deepEqual(result.keys.sort(), ['keep___pair','new___pair']);
  const next = await writeIgnoredDuplicateChanges(db, project, [{ key: 'other___pair', ignored: true, token: 'three' }]);
  assert.equal(next.revision, 2); assert.ok(next.keys.includes('keep___pair'));
});
test('concurrent clients retain independent not-a-duplicate choices', async () => {
  const first = identity('editor') as unknown as Firestore, second = identity('researcher') as unknown as Firestore;
  const ref = doc(first, 'projects', project, 'systemSettings', 'ignoredDuplicates');
  await setDoc(ref, { keys: [], revision: 0 });
  await Promise.all([
    writeIgnoredDuplicateChanges(first, project, [{ key: 'a___b', ignored: true, token: 'one' }]),
    writeIgnoredDuplicateChanges(second, project, [{ key: 'c___d', ignored: true, token: 'two' }])
  ]);
  const result = (await getDoc(ref)).data()!;
  assert.deepEqual(result.keys.sort(), ['a___b','c___d']); assert.equal(result.revision, 2);
});
test('viewer and anonymous clients cannot rewrite duplicate choices', async () => {
  const db = identity('admin') as unknown as Firestore;
  const ref = doc(db, 'projects', project, 'systemSettings', 'ignoredDuplicates');
  await setDoc(ref, { keys: ['keep___pair'], revision: 1 });
  for (const actor of [identity('viewer'), env.unauthenticatedContext().firestore()]) {
    await assertFails(writeIgnoredDuplicateChanges(actor as unknown as Firestore, project, [{ key: 'keep___pair', ignored: false, token: 'one' }]));
  }
  assert.deepEqual((await getDoc(ref)).data()!.keys, ['keep___pair']);
});

test('viewer can download the tree with the read-only adapter without deleting or migrating cloud records', async () => {
  const viewer = identity('viewer') as unknown as Firestore;
  const result = await readProjectFromFirestore(viewer, project);
  assert.deepEqual(result.data.persons!.map(person => person.id).sort(), ['deceased','living']);
  const admin = identity('admin') as unknown as Firestore;
  assert.equal((await getDoc(doc(admin, 'projects', project, 'persons', 'living'))).data()!.firstName, 'Private');
  assert.equal((await getDocs(collection(admin, 'projects', project, 'systemSettings'))).size, 0);
});

test('family merge writes remove a parent and restore memberships without leaving a stale cloud parent', async () => {
  const db = identity('editor') as unknown as Firestore;
  const ref = doc(db, 'projects', project, 'families', 'restore');
  const initial = { restore: { id: 'restore', husbandId: 'dad', wifeId: 'mom', children: [{ personId: 'child' }], childrenIds: ['child'], marriageDate: '1900' } };
  await setDoc(ref, initial.restore);
  const removed = removeFamilyMemberships(initial, new Set(['dad','child']));
  await setDoc(ref, serializeFamilyForCloud(removed.families.restore), { merge: true });
  const afterDelete = (await getDoc(ref)).data()!;
  assert.equal(afterDelete.husbandId, null);
  assert.deepEqual(afterDelete.childrenIds, []);
  const restored = restoreFamilyMemberships(removed.families, removed.history, ['child','dad']);
  await setDoc(ref, serializeFamilyForCloud(restored.families.restore), { merge: true });
  assert.deepEqual((await getDoc(ref)).data(), initial.restore);
});

test('merge mapping transactions retain concurrent unrelated merges and remove an undone ID', async () => {
  const { writeMergedPersonChanges } = await import('../src/services/mergedPersonCloudService');
  const db = identity('editor') as unknown as Firestore;
  await Promise.all([writeMergedPersonChanges(db, project, { duplicate: 'master' }), writeMergedPersonChanges(db, project, { other: 'target' })]);
  const result = await writeMergedPersonChanges(db, project, { duplicate: null });
  assert.deepEqual(result, { mapping: { other: 'target' }, revision: 3 });
  const saved = (await getDoc(doc(db, `projects/${project}/systemSettings/mergedPersons`))).data();
  assert.deepEqual(saved?.mapping, { other: 'target' });
  const read = await readProjectFromFirestore(db, project);
  assert.equal(read.settings.mergedPersonsRevision, 3); assert.deepEqual(read.settings.mergedPersons, { other: 'target' });
});
test('readers cannot change merge mappings and an invalid revision is rejected without overwriting data', async () => {
  const { writeMergedPersonChanges } = await import('../src/services/mergedPersonCloudService');
  await assertFails(writeMergedPersonChanges(identity('viewer') as unknown as Firestore, project, { duplicate: 'master' }));
  await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), `projects/${project}/systemSettings/mergedPersons`), { mapping: { other: 'target' }, revision: -1 }));
  await assert.rejects(writeMergedPersonChanges(identity('editor') as unknown as Firestore, project, { duplicate: null }), /Invalid merged/);
  await assert.rejects(readProjectFromFirestore(identity('editor') as unknown as Firestore, project), /Invalid cloud merge revision/);
  assert.deepEqual((await getDoc(doc(identity('editor'), `projects/${project}/systemSettings/mergedPersons`))).data()?.mapping, { other: 'target' });
});
