/** In-process Star CloudPRNT job queue (printer polls GET /cloudprnt). */
const queue: Uint8Array[] = [];

export function enqueueStarCloudPrnt(data: Uint8Array): void {
  queue.push(data);
}

export function dequeueStarCloudPrnt(): Uint8Array | undefined {
  return queue.shift();
}

export function starCloudPrntQueueLength(): number {
  return queue.length;
}
