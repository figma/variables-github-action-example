export function green(msg: string) {
  return `\x1b[32m${msg}\x1b[0m`
}

export function brightRed(msg: string) {
  return `\x1b[1;31m${msg}\x1b[0m`
}

export function areSetsEqual<T>(a: Set<T>, b: Set<T>) {
  return a.size === b.size && [...a].every((item) => b.has(item))
}
