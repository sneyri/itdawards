import { json, raw } from 'express';
import { rasterTypes } from '../modules/awards/images.js';

export const parseApiJson = json({ limit: '16kb' });
export const parseCatalogJson = json({ limit: '512kb' });
export const parseCatalogImage = raw({ type: rasterTypes, limit: '2mb', inflate: false });
