import {expect} from "@jest/globals";

export const toHaveChannel = (actual: Partial<{channel: {name: string}}>, channel: string) => {
    const actualChannel = actual?.channel?.name;
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

