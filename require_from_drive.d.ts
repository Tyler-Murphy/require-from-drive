export function requireFromDrive({
  path,
  cache,
  cacheInFile,
}: {
  path: string,
  cache?: boolean,
  cacheInFile?: boolean,
}): { [key: string]: any }
