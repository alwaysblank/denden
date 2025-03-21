import Hub from '../src/hub';

test('Create a hub', () => {
	const hub = new Hub();
	expect(hub).toBeInstanceOf(Hub);
});

test('Subscribe and receive', () => {
	const hub = new Hub();
	const callback = jest.fn();
	hub.sub('test', callback);
	hub.pub('test', 'sandwich');
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith('sandwich');
});

test('Subscribe and receive multiple', () => {
	const hub = new Hub();
	const callback = jest.fn();
	hub.sub('test', callback);
	hub.pub('test', 'sandwich');
	hub.pub('test', 'hamburger');
	hub.pub('test', 'salad');
	expect(callback).toHaveBeenCalledTimes(3);
	expect(callback).toHaveBeenCalledWith('sandwich');
	expect(callback).toHaveBeenCalledWith('hamburger');
	expect(callback).toHaveBeenCalledWith('salad');
	expect(hub.getMessages('test')).toHaveLength(3);
});

test('Subscribe and receive old', () => {
	const hub = new Hub();
	const callback = jest.fn();
	hub.pub('test', 'sandwich');
	hub.sub('test', callback, 1);
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith('sandwich');
});

test('Subscribe and don\'t receive old', () => {
	const hub = new Hub();
	const callback = jest.fn();
	hub.pub('test', 'sandwich');
	hub.sub('test', callback);
	expect(callback).toHaveBeenCalledTimes(0);
});

test('Subscribe and unsubscribe', () => {
	const hub = new Hub();
	const callback = jest.fn();
	const unsub = hub.sub('test', callback);
	hub.pub('test', 'sandwich');
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith('sandwich');
	expect(hub.getMessages('test')).toHaveLength(1)
	unsub();
	hub.pub('test', 'hamburger');
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith('sandwich');
	expect(hub.getMessages('test')).toHaveLength(2)
});

test('Watch another event dispatcher', () => {
	const emitter = new EventTarget();
	const hub = new Hub();
	const callback = jest.fn();
	const unwatch = hub.watch('emitter', emitter, 'test', e => e.type);
	hub.sub('emitter', callback);
	emitter.dispatchEvent(new Event('test'));
	expect(callback).toHaveBeenCalledTimes(1);
	expect(callback).toHaveBeenCalledWith('test');
	expect(hub.getMessages('emitter')).toHaveLength(1);
	unwatch();
	emitter.dispatchEvent(new Event('test'));
	expect(callback).toHaveBeenCalledTimes(1);
	expect(hub.getMessages('emitter')).toHaveLength(1);
});

test('Get past messages', () => {
	const hub = new Hub();
	hub.pub('test', 'sandwich');
	hub.pub('test', 'hamburger');
	hub.pub('test', 'salad');
	expect(hub.getMessages('test')).toHaveLength(3); // Default is to return all.
	expect(hub.getMessages('test', Infinity)).toHaveLength(3);
	expect(hub.getMessages('test', 1)).toHaveLength(1);
	expect(hub.getMessages('test', -1)).toHaveLength(1);
	expect(hub.getMessages('test', 2)).toHaveLength(2);
	expect(hub.getMessages('test', 1)[0].payload).toBe('salad'); // Should return last item.
	expect(hub.getMessages('test', -1)[0].payload).toBe('sandwich'); // Should return first item.
})
