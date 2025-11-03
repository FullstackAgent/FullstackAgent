import type { Database, Project, User } from '@prisma/client'
import { EventEmitter } from 'node:events'

export const bus = new EventEmitter()

export const Events = {
  CreateDatabase: 'database.create',
  StartDatabase: 'database.start',
  StopDatabase: 'database.stop',
  DeleteDatabase: 'database.delete',
} as const

export type DatabaseEventPayload = {
  user: User
  project: Project
  database: Database
}

export type BusEvents = {
  [Events.CreateDatabase]: DatabaseEventPayload
  [Events.StartDatabase]: DatabaseEventPayload
  [Events.StopDatabase]: DatabaseEventPayload
  [Events.DeleteDatabase]: DatabaseEventPayload
}

export function on<E extends keyof BusEvents>(
  event: E,
  handler: (payload: BusEvents[E]) => void | Promise<void>
) {
  bus.on(event, handler)
}

export function emit<E extends keyof BusEvents>(event: E, payload: BusEvents[E]) {
  bus.emit(event, payload)
}