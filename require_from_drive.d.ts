type Options = {
  path: string,
  cache?: boolean,
  cacheInFile?: boolean,
}
type Result = { [key: string]: any }

export function requireFromDrive(options: Options): Result

export function requireFromDriveAsynchronously(options: Pick<Options, 'path'>): Promise<Result>
