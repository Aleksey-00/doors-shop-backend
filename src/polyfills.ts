import * as crypto from 'crypto';

if (!global.crypto) {
    Object.defineProperty(global, 'crypto', {
        value: {
            getRandomValues: (buffer: Uint8Array) => {
                return crypto.randomFillSync(buffer);
            }
        }
    });
}