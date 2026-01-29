import {describe, expect} from '@jest/globals';
import {Hub} from '../../src';
import {watch} from '../../src';
import "../../definitions/toHaveChannel.d.ts"

describe('Other message sources', () => {
	it('should ingest messages from processing other events', () => {
		const emitter = new EventTarget();
		const hub = new Hub();
		const callback = jest.fn();
		const unwatch = watch(hub, 'emitter', emitter, 'test', e => e.type);
		hub.sub('emitter', callback);
		emitter.dispatchEvent(new Event('test'));
		expect(callback).toHaveBeenCalledTimes(1);
		expect(callback).toHaveBeenCalledWith('test', expect.toHaveChannel('emitter'), expect.any(Function));
		expect(hub.getMessages({cid:'emitter', limit: Infinity})).toHaveLength(1);
		unwatch();
		emitter.dispatchEvent(new Event('test'));
		expect(callback).toHaveBeenCalledTimes(1);
		expect(hub.getMessages({cid:'emitter', limit: Infinity})).toHaveLength(1);
	});

	it('should pass along the entire event if no callback is provided', () => {
		const emitter = new EventTarget();
		const hub = new Hub();
		const cb = jest.fn();
		watch(hub, 'emitter', emitter, 'test');
		hub.sub('emitter', cb);
		const event = new Event('test');
		emitter.dispatchEvent(event);
		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith(event, expect.toHaveChannel('emitter'), expect.any(Function));
	});
});
