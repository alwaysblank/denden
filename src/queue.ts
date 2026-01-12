import { Hub } from './hub';

/**
 * Record which will be broadcast on the channel specified by the first element.
 */
export type QueuedMessage= [string, unknown];

/**
 * A callback to be executed.
 */
export type QueuedCommand = (hub: Hub) => any;

/**
 * A record in the queue.
 */
export type QueuedRecord = QueuedMessage | QueuedCommand;

/**
 * Is this a {@link QueuedMessage}?
 */
const isQueuedMessage = <Payload>(record: unknown): record is QueuedMessage => {
    if (!Array.isArray(record) || record.length !==2) {
        return false;
    }
    const [channel] = record;
    return 'string' === typeof channel;
}

/**
 * Is this a {@link QueuedCommand}?
 */
const isQueuedCommand = (record: unknown): record is QueuedCommand => {
    return 'function' === typeof record;
}

/**
 * Determine record type.
 */
const getRecordType = (record: QueuedRecord) => {
	if (isQueuedMessage(record)) {
		return 'MESSAGE';
	}
	if (isQueuedCommand(record)) {
		return 'COMMAND';
	}
	return 'UNKNOWN';
}

/**
 * Appropriately handle {@link record} based on its type.
 */
const processRecord = (hub: Hub, record: QueuedRecord) => {
	if (isQueuedMessage(record)) {
		hub.pub(record[0], record[1]);
	}
	if (isQueuedCommand(record)) {
		record(hub);
	}
};

/**
 * Returns proxied version of {@link queuedMessages}.
 *
 * When created, this will:
 *
 * - Send any {@link QueuedMessage queued messages} to {@link hub}.
 * - Run any {@link QueuedCommand queued commands} with {@link hub} as the only argument.
 *
 * Once created, pushing (or otherwise adding) a row to the "queue"
 * will cause that row to be processed immediately. Order does not matter
 * when adding items, only in the initial {@link queuedMessages} array.
 *
 * @param queuedMessages Array of messages with the name of the channel they are associated with.
 * @param hub {@link Hub} that this queue is associated with.
 */
export function makeQueue(hub: Hub, queuedMessages: Array<QueuedRecord>) {
    for (const msg of queuedMessages) {
		processRecord(hub, msg);
    }
    return new Proxy(queuedMessages, {
        set(obj, key, value) {
            if ('string' === typeof key && Number.isInteger(parseInt(key, 10))) {
				if ('UNKNOWN' === getRecordType(value)) {
					console.error('Queues only accept records of type QueuedMessage or QueuedCommand');
				} else {
					processRecord(hub, value);
				}
            }
            return Reflect.set(obj, key, value);
        }
    });
}