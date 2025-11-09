import { customAlphabet } from 'nanoid'

// Character set: uppercase, lowercase, and numbers only
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const nanoidAlphanumeric = customAlphabet(alphabet)

export function generateRandomString(length: number = 12): string {
  return nanoidAlphanumeric(length)
}
