declare module 'expect' {
    interface AsymmetricMatchers {
        toHaveChannel(channel: string): void;
    }
    interface Matchers<R> {
        toHaveChannel(channel: string): R;
    }
}

export {}