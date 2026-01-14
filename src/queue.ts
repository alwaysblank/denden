import Hub from "./hub";

export type QueueRecord<T> = [string, T];

const handleMessage = (record: QueueRecord<unknown>, hub: Hub) => {
    const [channel, payload] = record;
    hub.pub(channel, payload);
}

const isQueueRecord = (record: unknown): record is QueueRecord<unknown> => {
    if (!Array.isArray(record) || record.length !==2) {
        return false;
    }
    const [channel] = record;
    return 'string' === typeof channel;
}

export default function(load: Array<QueueRecord<unknown>>, hub: Hub) {
    for (const msg of load) {
        handleMessage(msg, hub);
    }
    return new Proxy(load, {
        set(obj, key, value) {
            if ('string' === typeof key && Number.isInteger(parseInt(key, 10)) && isQueueRecord(value)) {
                handleMessage(value, hub);
            }
            return Reflect.set(obj, key, value);
        }
    });
}