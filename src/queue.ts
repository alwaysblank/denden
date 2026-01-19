import Hub from "./hub";

export type QueueRecord<T> = [string, T];

const isQueueRecord = <Payload>(record: unknown): record is QueueRecord<Payload> => {
    if (!Array.isArray(record) || record.length !==2) {
        return false;
    }
    const [channel] = record;
    return 'string' === typeof channel;
}

export type QueueCallback<Payload> = (hub: Hub, record: QueueRecord<Payload>) => void;

/**
 * Returns a proxy for event `queuedMessages`, and calls `callback()` on each row in `queuedMessages` as well as any time a new row is added to the proxy.
 *
 * @param callback Called on each row, either when the queue is created or when the row is added.
 * @param queuedMessages Array of messages with the name of the channel they are associated with.
 * @param hub {@link Hub} that this queue is associated with.
 */
export default function<Payload>(hub: Hub, callback: QueueCallback<Payload>, queuedMessages: Array<QueueRecord<Payload>>) {
    for (const msg of queuedMessages) {
        if (isQueueRecord(msg)) {
            callback(hub, msg);
        }
    }
    return new Proxy(queuedMessages, {
        set(obj, key, value) {
            if ('string' === typeof key && Number.isInteger(parseInt(key, 10)) && isQueueRecord<Payload>(value)) {
                callback(hub, value);
            }
            return Reflect.set(obj, key, value);
        }
    });
}