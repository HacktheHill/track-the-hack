/* eslint-disable @typescript-eslint/no-unsafe-argument -- IndexedDB object stores expose IDBRequest<any>; every value is scoped to this module's versioned stores. */
import type { RouterOutputs } from "@/server/api/api";
import {
	coalesceAssignmentOutboxPatch,
	createRankingOutboxPatch,
	judgingOfflineNamespace,
	nextEffectiveJudgingEditTime,
	type AssignmentOutboxPatch,
	type RankingOutboxPatch,
} from "@/client/judging-offline-state";

export type JudgingManifest = RouterOutputs["judging"]["manifest"];

export type OfflineAssignmentPatch = AssignmentOutboxPatch;

export type OfflineRankingPatch = RankingOutboxPatch;

export type OfflineJudgingPatch = OfflineAssignmentPatch | OfflineRankingPatch;

type OfflineSnapshot = {
	key: "active";
	namespace: string;
	manifest: JudgingManifest;
	preparedAt: string;
	serverOffsetMs: number;
};

const DATABASE_NAME = "track-the-hack-judging";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshot";
const OUTBOX_STORE = "outbox";
const wallClockAtModuleLoad = Date.now();
const monotonicClockAtModuleLoad = typeof performance === "undefined" ? 0 : performance.now();
const lastEditByNamespace = new Map<string, number>();

const manifestNamespace = (manifest: JudgingManifest) =>
	judgingOfflineNamespace(manifest.judge.round.id, manifest.judge.id, DATABASE_VERSION);

const requestResult = <T>(request: IDBRequest<T>) =>
	new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
	});

const transactionDone = (transaction: IDBTransaction) =>
	new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
		transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
	});

const openDatabase = () =>
	new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(SNAPSHOT_STORE))
				database.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
			if (!database.objectStoreNames.contains(OUTBOX_STORE))
				database.createObjectStore(OUTBOX_STORE, { keyPath: "key" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("Could not open offline judging storage"));
	});

const withDatabase = async <T>(callback: (database: IDBDatabase) => Promise<T>) => {
	if (typeof indexedDB === "undefined") throw new Error("Offline storage is unavailable in this browser");
	const database = await openDatabase();
	try {
		return await callback(database);
	} finally {
		database.close();
	}
};

export const saveJudgingSnapshot = async (manifest: JudgingManifest) =>
	withDatabase(async database => {
		const transaction = database.transaction([SNAPSHOT_STORE, OUTBOX_STORE], "readwrite");
		const snapshotStore = transaction.objectStore(SNAPSHOT_STORE);
		const current = await requestResult<OfflineSnapshot | undefined>(snapshotStore.get("active"));
		if (
			current &&
			(current.manifest.judge.id !== manifest.judge.id ||
				current.manifest.judge.round.id !== manifest.judge.round.id)
		) {
			transaction.objectStore(OUTBOX_STORE).clear();
		}
		const serverOffsetMs = new Date(manifest.serverTime).getTime() - Date.now();
		snapshotStore.put({
			key: "active",
			namespace: manifestNamespace(manifest),
			manifest,
			preparedAt: new Date().toISOString(),
			serverOffsetMs,
		} satisfies OfflineSnapshot);
		await transactionDone(transaction);
	});

export const loadJudgingSnapshot = async () =>
	withDatabase(async database => {
		const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
		const snapshot = await requestResult<OfflineSnapshot | undefined>(
			transaction.objectStore(SNAPSHOT_STORE).get("active"),
		);
		await transactionDone(transaction);
		return snapshot ?? null;
	});

export const listJudgingOutbox = async () => {
	const snapshot = await loadJudgingSnapshot();
	if (!snapshot) return [];
	return withDatabase(async database => {
		const transaction = database.transaction(OUTBOX_STORE, "readonly");
		const patches = await requestResult<OfflineJudgingPatch[]>(transaction.objectStore(OUTBOX_STORE).getAll());
		await transactionDone(transaction);
		return patches
			.filter(patch => patch.namespace === snapshot.namespace)
			.sort((a, b) => a.editedAt.localeCompare(b.editedAt));
	});
};

const offlineContext = async () => {
	const snapshot = await loadJudgingSnapshot();
	if (!snapshot) throw new Error("Open judging online once before saving offline work");
	const monotonicWallTime =
		typeof performance === "undefined"
			? Date.now()
			: wallClockAtModuleLoad + (performance.now() - monotonicClockAtModuleLoad);
	const { effectiveMs, editedAt } = nextEffectiveJudgingEditTime(
		monotonicWallTime + snapshot.serverOffsetMs,
		lastEditByNamespace.get(snapshot.namespace),
	);
	lastEditByNamespace.set(snapshot.namespace, effectiveMs);
	return {
		namespace: snapshot.namespace,
		editedAt,
	};
};

export const queueAssignmentPatch = async (assignmentId: string, values: Record<string, unknown>) => {
	const { editedAt, namespace } = await offlineContext();
	return withDatabase(async database => {
		const key = `${namespace}:assignment:${assignmentId}`;
		const transaction = database.transaction(OUTBOX_STORE, "readwrite");
		const store = transaction.objectStore(OUTBOX_STORE);
		const existing = await requestResult<OfflineAssignmentPatch | undefined>(store.get(key));
		store.put(
			coalesceAssignmentOutboxPatch({
				existing,
				namespace,
				assignmentId,
				values,
				editedAt,
				operationId: crypto.randomUUID(),
			}),
		);
		await transactionDone(transaction);
	});
};

export const queueRankingPatch = async (categoryCode: string, projectIds: string[]) => {
	const { editedAt, namespace } = await offlineContext();
	return withDatabase(async database => {
		const transaction = database.transaction(OUTBOX_STORE, "readwrite");
		const store = transaction.objectStore(OUTBOX_STORE);
		store.put(
			createRankingOutboxPatch({
				namespace,
				categoryCode,
				projectIds,
				editedAt,
				operationId: crypto.randomUUID(),
			}),
		);
		await transactionDone(transaction);
	});
};

export const removeJudgingOutboxEntries = async (operationIds: string[]) =>
	withDatabase(async database => {
		const transaction = database.transaction(OUTBOX_STORE, "readwrite");
		const store = transaction.objectStore(OUTBOX_STORE);
		const entries = await requestResult<OfflineJudgingPatch[]>(store.getAll());
		for (const entry of entries) if (operationIds.includes(entry.operationId)) store.delete(entry.key);
		await transactionDone(transaction);
	});

export const clearOfflineJudgingData = async () =>
	withDatabase(async database => {
		const transaction = database.transaction([SNAPSHOT_STORE, OUTBOX_STORE], "readwrite");
		transaction.objectStore(SNAPSHOT_STORE).clear();
		transaction.objectStore(OUTBOX_STORE).clear();
		await transactionDone(transaction);
	});
