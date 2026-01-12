import {expect} from "@jest/globals";

export const toHaveChannel = (actual: Partial<{channel: string}>, channel: string) => {
    const actualChannel = actual?.channel;
    const errMsg = () => {
        return `expected ${channel}, got ${actualChannel || 'no channel found'}`;
    }
    if (actualChannel === channel) {
        return {
            message: errMsg,
            pass: true,
        }
    }
    return {
        message: errMsg,
        pass: false,
    }
}

expect.extend({
    toHaveChannel,
});

