export function isK8sNotFound(error: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = error as any
  const code = e?.code ?? e?.statusCode ?? e?.response?.statusCode
  return code === 404
}
