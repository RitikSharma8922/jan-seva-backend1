// Express 4 doesn't forward rejected promises from async handlers to next()
// automatically. Wrapping each handler with this fixes that.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
