interface Blob {
  readonly size: number
  readonly type: string
}

interface File extends Blob {
  readonly lastModified: number
  readonly name: string
}

declare var File: {
  prototype: File;
  new(fileBits: unknown[], fileName: string, options?: unknown): File;
}
