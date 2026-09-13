import { normalizeEvent } from '../domain/events/eventSchema.js';

export const WORLD_RECORD_SCHEMA_VERSION = 1;
export const WORLD_RECORD_DATABASE_VERSION = 1;

const STORE_EVENTS = 'events';
const STORE_CHARTS = 'charts';
const STORE_WORKSPACES = 'workspaces';
const ALL_STORES = Object.freeze([STORE_EVENTS, STORE_CHARTS, STORE_WORKSPACES]);

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function copy(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted'));
  });
}

function normalizeChart(chart) {
  if (!chart || typeof chart !== 'object') throw new TypeError('Chart input is required');
  if (chart.schemaVersion !== 1) throw new RangeError(`Unsupported chart schema version: ${chart.schemaVersion}`);
  const normalized = copy(chart);
  normalized.chartId = requireText(chart.chartId, 'chart.chartId');
  normalized.eventId = requireText(chart.eventId, 'chart.eventId');
  const calculatedFor = new Date(chart.calculatedFor);
  if (!Number.isFinite(calculatedFor.getTime())) throw new TypeError('chart.calculatedFor must be a valid date');
  normalized.calculatedFor = calculatedFor.toISOString();
  requireText(chart.engine?.id, 'chart.engine.id');
  requireText(chart.engine?.version, 'chart.engine.version');
  return normalized;
}

function normalizeWorkspace(workspace) {
  const parsed = typeof workspace === 'string' ? JSON.parse(workspace) : workspace;
  if (!parsed || typeof parsed !== 'object') throw new TypeError('Workspace input is required');
  if (parsed.schemaVersion !== WORLD_RECORD_SCHEMA_VERSION) {
    throw new RangeError(`Unsupported workspace schema version: ${parsed.schemaVersion}`);
  }
  if (!Array.isArray(parsed.events) || !Array.isArray(parsed.charts) || !Array.isArray(parsed.workspaces)) {
    throw new TypeError('Workspace export must contain events, charts, and workspaces arrays');
  }
  const events = parsed.events.map(normalizeEvent);
  const eventIds = new Set(events.map(({ id }) => id));
  if (eventIds.size !== events.length) throw new RangeError('Workspace contains duplicate event IDs');
  const charts = parsed.charts.map(normalizeChart);
  const chartIds = new Set(charts.map(({ chartId }) => chartId));
  if (chartIds.size !== charts.length) throw new RangeError('Workspace contains duplicate chart IDs');
  const workspaces = parsed.workspaces.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new TypeError('Workspace records must be objects');
    return { ...copy(entry), id: requireText(entry.id, 'workspace.id') };
  });
  const workspaceIds = new Set(workspaces.map(({ id }) => id));
  if (workspaceIds.size !== workspaces.length) throw new RangeError('Workspace contains duplicate workspace IDs');
  return { schemaVersion: WORLD_RECORD_SCHEMA_VERSION, events, charts, workspaces };
}

function sortBy(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function recordFingerprint(value) {
  // Object key order is not a data change; array order remains significant.
  return JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
    ? Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]])) : entry);
}

/** Native IndexedDB persistence shared by AstroEye and future product modules. */
export function createWorldRecordStore({
  indexedDB: indexedDbFactory = globalThis.indexedDB,
  databaseName = 't-rexx-world-engine',
} = {}) {
  if (!indexedDbFactory?.open) {
    throw new Error('IndexedDB is unavailable; durable world records cannot be opened in this environment');
  }
  requireText(databaseName, 'databaseName');
  let databasePromise;

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDbFactory.open(databaseName, WORLD_RECORD_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_EVENTS)) {
          database.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(STORE_CHARTS)) {
          const charts = database.createObjectStore(STORE_CHARTS, { keyPath: 'chartId' });
          charts.createIndex('eventId', 'eventId', { unique: false });
        }
        if (!database.objectStoreNames.contains(STORE_WORKSPACES)) {
          database.createObjectStore(STORE_WORKSPACES, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error ?? new Error('Unable to open IndexedDB'));
      };
      request.onblocked = () => {
        databasePromise = undefined;
        reject(new Error('IndexedDB upgrade is blocked by another open T-Rexx tab'));
      };
    });
    return databasePromise;
  }

  async function transact(storeNames, mode, operation) {
    const database = await openDatabase();
    const transaction = database.transaction(storeNames, mode);
    const completion = transactionComplete(transaction);
    try {
      const result = await operation(transaction);
      await completion;
      return result;
    } catch (error) {
      try { transaction.abort(); } catch { /* already completed or aborted */ }
      await completion.catch(() => {});
      throw error;
    }
  }

  async function put(storeName, value) {
    return transact([storeName], 'readwrite', async (transaction) => {
      await requestResult(transaction.objectStore(storeName).put(copy(value)));
      return copy(value);
    });
  }

  async function get(storeName, key) {
    return transact([storeName], 'readonly', async (transaction) => {
      const value = await requestResult(transaction.objectStore(storeName).get(key));
      return value == null ? null : copy(value);
    });
  }

  async function list(storeName, key) {
    return transact([storeName], 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);
      return copy(await requestResult(store.getAll())).sort(sortBy(key));
    });
  }

  async function remove(storeName, key) {
    return transact([storeName], 'readwrite', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const existed = await requestResult(store.getKey(key));
      if (existed == null) return false;
      await requestResult(store.delete(key));
      return true;
    });
  }

  async function snapshotRecords(transaction) {
    // Read one coherent snapshot, even when another tab edits records.
    const [events, charts, workspaces] = await Promise.all(
      ALL_STORES.map((name) => requestResult(transaction.objectStore(name).getAll())),
    );
    return { schemaVersion: WORLD_RECORD_SCHEMA_VERSION,
      events: copy(events).sort(sortBy('id')),
      charts: copy(charts).sort(sortBy('chartId')),
      workspaces: copy(workspaces).sort(sortBy('id')) };
  }

  async function exportRecords() {
    return transact(ALL_STORES, 'readonly', snapshotRecords);
  }

  return Object.freeze({
    schemaVersion: WORLD_RECORD_SCHEMA_VERSION,
    databaseName,
    async saveEvent(event) {
      return put(STORE_EVENTS, normalizeEvent(event));
    },
    async getEvent(eventId) {
      return get(STORE_EVENTS, requireText(eventId, 'eventId'));
    },
    async listEvents() {
      return list(STORE_EVENTS, 'id');
    },
    async deleteEvent(eventId, { capture = false } = {}) {
      const id = requireText(eventId, 'eventId');
      return transact([STORE_EVENTS, STORE_CHARTS], 'readwrite', async (transaction) => {
        const events = transaction.objectStore(STORE_EVENTS);
        const charts = transaction.objectStore(STORE_CHARTS);
        const event = await requestResult(events.get(id));
        if (event == null) return capture ? null : false;
        const savedCharts = await requestResult(charts.index('eventId').getAll(id));
        for (const chart of savedCharts) await requestResult(charts.delete(chart.chartId));
        await requestResult(events.delete(id));
        return capture ? { event: copy(event), charts: copy(savedCharts) } : true;
      });
    },
    async restoreDeletedEvent(snapshot) {
      const records = normalizeWorkspace({ schemaVersion: WORLD_RECORD_SCHEMA_VERSION,
        events: [snapshot?.event], charts: snapshot?.charts, workspaces: [] });
      const event = records.events[0];
      if (records.charts.some((chart) => chart.eventId !== event.id)) throw new Error('Deleted charts must belong to the restored event.');
      return transact([STORE_EVENTS, STORE_CHARTS], 'readwrite', async (transaction) => {
        const events = transaction.objectStore(STORE_EVENTS);
        const charts = transaction.objectStore(STORE_CHARTS);
        if (await requestResult(events.getKey(event.id)) != null) {
          throw new Error('Cannot undo: this event ID is already in use. Newer records were left unchanged.');
        }
        for (const chart of records.charts) {
          if (await requestResult(charts.getKey(chart.chartId)) != null) {
            throw new Error('Cannot undo: a saved chart ID is already in use. Newer records were left unchanged.');
          }
        }
        await requestResult(events.add(copy(event)));
        for (const chart of records.charts) await requestResult(charts.add(copy(chart)));
        return { eventId: event.id, charts: records.charts.length };
      });
    },
    async saveChart(chart) {
      const normalized = normalizeChart(chart);
      return transact([STORE_EVENTS, STORE_CHARTS], 'readwrite', async (transaction) => {
        const event = await requestResult(transaction.objectStore(STORE_EVENTS).getKey(normalized.eventId));
        if (event == null) throw new Error(`Cannot save chart for unknown event: ${normalized.eventId}`);
        await requestResult(transaction.objectStore(STORE_CHARTS).put(copy(normalized)));
        return copy(normalized);
      });
    },
    async saveEventWithChart(event, chart) {
      const normalizedEvent = normalizeEvent(event);
      const normalizedChart = normalizeChart(chart);
      if (normalizedChart.eventId !== normalizedEvent.id) {
        throw new RangeError('Chart eventId must match the event saved in the same transaction');
      }
      return transact([STORE_EVENTS, STORE_CHARTS], 'readwrite', async (transaction) => {
        await requestResult(transaction.objectStore(STORE_EVENTS).put(copy(normalizedEvent)));
        await requestResult(transaction.objectStore(STORE_CHARTS).put(copy(normalizedChart)));
        return Object.freeze({ event: copy(normalizedEvent), chart: copy(normalizedChart) });
      });
    },
    async getChart(chartId) {
      return get(STORE_CHARTS, requireText(chartId, 'chartId'));
    },
    async listCharts({ eventId } = {}) {
      if (eventId == null) return list(STORE_CHARTS, 'chartId');
      const id = requireText(eventId, 'eventId');
      return transact([STORE_CHARTS], 'readonly', async (transaction) => {
        const charts = await requestResult(transaction.objectStore(STORE_CHARTS).index('eventId').getAll(id));
        return copy(charts).sort(sortBy('chartId'));
      });
    },
    async deleteChart(chartId) {
      return remove(STORE_CHARTS, requireText(chartId, 'chartId'));
    },
    async saveWorkspace(workspace) {
      if (!workspace || typeof workspace !== 'object') throw new TypeError('Workspace record is required');
      const normalized = { ...copy(workspace), id: requireText(workspace.id, 'workspace.id') };
      return put(STORE_WORKSPACES, normalized);
    },
    async getWorkspace(workspaceId) {
      return get(STORE_WORKSPACES, requireText(workspaceId, 'workspaceId'));
    },
    async saveWorkspaceIfUnchanged(workspace, expected) {
      if (!workspace || typeof workspace !== 'object') throw new TypeError('Workspace record is required');
      const normalized = { ...copy(workspace), id: requireText(workspace.id, 'workspace.id') };
      if (expected !== null && (!expected || expected.id !== normalized.id)) throw new TypeError('Expected workspace must match the saved ID or be null.');
      const baseline = copy(expected);
      return transact([STORE_WORKSPACES], 'readwrite', async (transaction) => {
        const store = transaction.objectStore(STORE_WORKSPACES);
        const current = await requestResult(store.get(normalized.id)) ?? null;
        if (recordFingerprint(current) !== recordFingerprint(baseline)) {
          throw new Error('Research notes changed in storage. Your draft is unchanged. Copy it somewhere safe, then reload saved notes before saving again.');
        }
        await requestResult(store.put(normalized));
        return copy(normalized);
      });
    },
    async listWorkspaces() {
      return list(STORE_WORKSPACES, 'id');
    },
    async exportRecords() {
      return exportRecords();
    },
    async serializeRecords() {
      return `${JSON.stringify(await exportRecords(), null, 2)}\n`;
    },
    async previewImportRecords(input) {
      const records = normalizeWorkspace(input);
      const snapshot = await exportRecords();
      const eventIds = new Set([...snapshot.events, ...records.events].map(({ id }) => id));
      for (const chart of records.charts) {
        if (!eventIds.has(chart.eventId)) throw new Error(`Imported chart references unknown event: ${chart.eventId}`);
      }
      const summary = {};
      const changes = { schemaVersion: records.schemaVersion };
      for (const [name, key] of [['events', 'id'], ['charts', 'chartId'], ['workspaces', 'id']]) {
        const existing = new Map(snapshot[name].map((entry) => [entry[key], entry]));
        const counts = { added: 0, overwrite: 0, unchanged: 0 };
        changes[name] = records[name].filter((entry) => {
          const previous = existing.get(entry[key]);
          if (!previous) { counts.added++; return true; }
          if (recordFingerprint(previous) === recordFingerprint(entry)) { counts.unchanged++; return false; }
          counts.overwrite++;
          return true;
        });
        summary[name] = counts;
      }
      if (!records.events.length && !records.charts.length && !records.workspaces.length) {
        throw new Error('This file contains no records to import.');
      }
      return { records: changes, summary, expectedSnapshot: JSON.stringify(snapshot) };
    },
    async importRecords(input, { mode = 'merge', expectedSnapshot } = {}) {
      if (!['merge', 'replace'].includes(mode)) throw new RangeError(`Unsupported import mode: ${mode}`);
      const records = normalizeWorkspace(input);
      return transact(ALL_STORES, 'readwrite', async (transaction) => {
        if (expectedSnapshot !== undefined && JSON.stringify(await snapshotRecords(transaction)) !== expectedSnapshot) {
          throw new Error('Saved records changed since this review. Choose the file again to review the current changes. Nothing was imported.');
        }
        const events = transaction.objectStore(STORE_EVENTS);
        const charts = transaction.objectStore(STORE_CHARTS);
        const workspaces = transaction.objectStore(STORE_WORKSPACES);
        if (mode === 'replace') {
          await Promise.all([requestResult(events.clear()), requestResult(charts.clear()), requestResult(workspaces.clear())]);
        }
        for (const event of records.events) await requestResult(events.put(copy(event)));
        for (const chart of records.charts) {
          const linkedEvent = await requestResult(events.getKey(chart.eventId));
          if (linkedEvent == null) throw new Error(`Imported chart references unknown event: ${chart.eventId}`);
          await requestResult(charts.put(copy(chart)));
        }
        for (const workspace of records.workspaces) await requestResult(workspaces.put(copy(workspace)));
        return Object.freeze({
          mode,
          events: records.events.length,
          charts: records.charts.length,
          workspaces: records.workspaces.length,
        });
      });
    },
    async close() {
      const database = await openDatabase();
      database.close();
      databasePromise = undefined;
    },
  });
}
