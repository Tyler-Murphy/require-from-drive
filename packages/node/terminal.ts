import readline from 'node:readline/promises'

/** Makes the prompt bold */
const getInput = async (prompt: string, options?: {
  validate?: {
    /** Return `true` to pass validation. Return a string with an error message to reject the input. */
    condition: (raw: string) => true | string,
    maximumTries: number
  }
}): Promise<string> => {
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  })

  try {
    let tries = 0
    while (tries < (options?.validate?.maximumTries ?? 1)) {
      tries += 1

      const unvalidatedResponse = await terminal.question(`\x1b[1m${prompt}\x1b[0m `)

      if (options?.validate != null) {
        const validationOutcome = options.validate.condition(unvalidatedResponse)

        if (validationOutcome !== true) {
          console.log(validationOutcome)

          continue
        }
      }

      return unvalidatedResponse
    }
  } finally {
    terminal.close()
  }

  throw new Error(`Failed to get input`)
}

export {
	getInput,
}
