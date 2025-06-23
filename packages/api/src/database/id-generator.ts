import { customAlphabet } from 'nanoid';

const CUSTOM_ALPHABET = '346789ABCDEFGHJKLMNPQRTUVWXY';
const ID_LENGTH = 12;

const generateNanoId = customAlphabet(CUSTOM_ALPHABET, ID_LENGTH);

export function generateIncidentId(): string {
  return generateNanoId();
}
