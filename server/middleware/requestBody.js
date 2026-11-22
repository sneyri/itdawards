import { json, raw } from 'express';
import { rasterTypes } from '../modules/awards/images.js';
import { audioTypes } from '../modules/awards/audio.js';

export const parseApiJson = json({ limit: '16kb' });
export const parseCatalogJson = json({ limit: '512kb' });
export const parseCatalogImage = raw({ type: rasterTypes, limit: '5mb', inflate: false });
export const parseCatalogAudio = raw({ type: audioTypes, limit: '20mb', inflate: false });
