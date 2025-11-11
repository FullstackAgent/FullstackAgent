import type { Project, Sandbox, User } from '@prisma/client'
import { EventEmitter } from 'node:events'

export const bus = new EventEmitter()

export const Events = {
  CreateSandbox: 'sandbox.create',
  StartSandbox: 'sandbox.start',
  StopSandbox: 'sandbox.stop',
  DeleteSandbox: 'sandbox.delete',
  UpdateSandbox: 'sandbox.update',
} as const

export type SandboxEventPayload = {
  user: User
  project: Project
  sandbox: Sandbox
}

export type BusEvents = {
  [Events.CreateSandbox]: SandboxEventPayload
  [Events.StartSandbox]: SandboxEventPayload
  [Events.StopSandbox]: SandboxEventPayload
  [Events.DeleteSandbox]: SandboxEventPayload
  [Events.UpdateSandbox]: SandboxEventPayload
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
