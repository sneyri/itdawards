import { fileURLToPath } from 'node:url';

export const dist = fileURLToPath(new URL('../../../client/dist/', import.meta.url));
export const assets = fileURLToPath(new URL('../../../client/assets/', import.meta.url));
export const control = fileURLToPath(new URL('../../../client/admin/', import.meta.url));
