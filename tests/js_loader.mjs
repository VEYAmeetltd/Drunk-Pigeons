// Node loader that resolves extensionless relative imports to .js
export function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z]+$/i.test(specifier)) {
    return next(specifier + '.js', context);
  }
  return next(specifier, context);
}
