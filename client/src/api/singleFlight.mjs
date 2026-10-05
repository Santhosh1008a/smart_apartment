export const createSingleFlight = (operation) => {
  let pending

  return (...args) => {
    if (!pending) {
      pending = Promise.resolve()
        .then(() => operation(...args))
        .finally(() => { pending = undefined })
    }
    return pending
  }
}

export const withExclusiveLock = (lockManager, name, operation) => (
  lockManager?.request ? lockManager.request(name, operation) : operation()
)
