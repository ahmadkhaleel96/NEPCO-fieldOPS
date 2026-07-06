import * as FileSystem from 'expo-file-system';
import type { ApiClient } from '@fieldops/api-client';

type OperationType = 'nfc_arrival' | 'inspection_submit';

interface QueuedOperation {
  id: string;
  type: OperationType;
  payload: Record<string, unknown>;
  created_at: number;
  attempts: number;
}

const QUEUE_FILE = `${FileSystem.documentDirectory}offline_queue.json`;
const MAX_ATTEMPTS = 5;

async function readQueue(): Promise<QueuedOperation[]> {
  try {
    const info = await FileSystem.getInfoAsync(QUEUE_FILE);
    if (!info.exists) return [];
    const text = await FileSystem.readAsStringAsync(QUEUE_FILE);
    return JSON.parse(text) as QueuedOperation[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedOperation[]): Promise<void> {
  await FileSystem.writeAsStringAsync(QUEUE_FILE, JSON.stringify(queue));
}

export async function enqueue(
  type: OperationType,
  payload: Record<string, unknown>,
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    id: crypto.randomUUID(),
    type,
    payload,
    created_at: Date.now(),
    attempts: 0,
  });
  await writeQueue(queue);
}

export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function flush(client: ApiClient): Promise<void> {
  const queue = await readQueue();
  if (queue.length === 0) return;

  const remaining: QueuedOperation[] = [];
  for (const op of queue) {
    try {
      if (op.type === 'nfc_arrival') {
        await client.nfcEvents.recordArrival(
          op.payload as unknown as Parameters<typeof client.nfcEvents.recordArrival>[0],
        );
      } else if (op.type === 'inspection_submit') {
        await client.assetInspections.submit(
          op.payload as unknown as Parameters<typeof client.assetInspections.submit>[0],
        );
      }
    } catch {
      if (op.attempts + 1 < MAX_ATTEMPTS) {
        remaining.push({ ...op, attempts: op.attempts + 1 });
      }
    }
  }
  await writeQueue(remaining);
}
