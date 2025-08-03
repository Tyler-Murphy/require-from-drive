export {
  type ServerTokenConfiguration,
  type RequestQueryParameters,
  type ResponseError,
  type ResponseSuccess,
  type Response,
  type JSONValue,
  assertIsResponse,
  assertIsDefined,
}

// Useful globals

type JSONPrimitive = string | number | boolean | null
type JSONArray = JSONValue[]
interface JSONObject { [key: string]: JSONValue }
type JSONValue = JSONPrimitive | JSONArray | JSONObject

declare global {
  interface JSON {
    /**
     * Converts a JavaScript Object Notation (JSON) string into an object.
     * @param text A valid JSON string.
     */
    parse(text: string): JSONValue;
  }

  // See https://github.com/microsoft/TypeScript/issues/61321
  interface RegExpConstructor {
    escape(str: string): string;
  }
}

// Project-specific types

type ServerTokenConfiguration = Record<string, {
  description: string,
  totpSecret: string | null,
}>

type ErrorMessage =
  | `${`missing` | `invalid`} ${keyof RequestQueryParameters} query parameter`
  | `could not find folder ${string}`
  | `could not find file`
  | `found file but could not read`

const requestQueryParameters = [`token`, `path`, `totp`] as const
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const requestQueryParameterConfiguration = {
  token: {
    required: true,
  },
  path: {
    required: true,
  },
  totp: {
    required: false,
  }
} as const satisfies Record<typeof requestQueryParameters[number], { required: boolean }>

type RequestQueryParameters = {
  [name in keyof typeof requestQueryParameterConfiguration]: (typeof requestQueryParameterConfiguration)[name]['required'] extends true ? string : (string | null)
}

const errorMessageMatchers: RegExp[] = [
  RegExp(`^(?:missing|invalid) (?:${requestQueryParameters.map(RegExp.escape).join(`|`)}) query parameter$`),
  /^could not find folder .*$/,
  /^could not find file$/,
  /^found file but could not read$/,
]

function assertIsResponseErrorMesage(value: string): ErrorMessage {
  if (!errorMessageMatchers.some(matcher => matcher.test(value))) {
    throw new Error(`expected value "${value}" to match one of ${errorMessageMatchers.toString()}`)
  }

  return value as ErrorMessage
}

type SemverString = `${number}.${number}.${number}`

type ResponseSuccess = {
  version: SemverString,
  status: `success`,
  content: string,
}

type ResponseError = {
  version: SemverString,
  status: `error`,
  message: ErrorMessage
}

type Response = ResponseSuccess | ResponseError

function assertIsSuccessResponse(value: JSONValue): ResponseSuccess {
  return {
    version: assertIsSemverString(getPropertyStringValue(value, `version`)),
    status: assertEqual(getPropertyStringValue(value, `status`), `success`),
    content: getPropertyStringValue(value, `content`)
  }
}

function assertIsErrorResponse(value: JSONValue): ResponseError {
  return {
    version: assertIsSemverString(getPropertyStringValue(value, `version`)),
    status: assertEqual(getPropertyStringValue(value, `status`), `error`),
    message: assertIsResponseErrorMesage(getPropertyStringValue(value, `message`))
  }
}

function assertIsResponse(value: JSONValue): Response {
  try {
    return assertIsErrorResponse(value)
  } catch (firstError: unknown) {
    try {
      return assertIsSuccessResponse(value)
    } catch (secondError: unknown) {
      throw new AggregateError(
        [
          firstError,
          secondError,
        ],
        `Response ${JSON.stringify(value)} doesn't match any of the expected response types`
      )
    }
  }
}

function getPropertyStringValue(object: JSONValue, propertyName: string): string {
  if (typeof object !== `object` || object == null || Array.isArray(object)) {
    throw new Error(`Expected object`)
  }

  if (!(propertyName in object)) {
    throw new Error(`Object doesn't have property "${propertyName}"`)
  }

  if (typeof object[propertyName] !== `string`) {
    throw new Error(`Value of property isn't a string`)
  }

  return object[propertyName]
}

function assertEqual<T extends JSONValue>(actual: JSONValue, expected: T): T {
  if (actual !== expected) {
    throw new Error(`Actual value ${JSON.stringify(actual)} does not equal expected value ${JSON.stringify(expected)}`)
  }

  return expected
}

const semverMatcher = /^([1-9]\d*|\d)\.([1-9]\d*|\d)\.([1-9]\d*|\d)$/

function assertIsSemverString(text: string): SemverString {
  if (semverMatcher.test(text)) {
    return text as SemverString
  }

  throw new Error(`Expected "${text}" to match pattern ${semverMatcher.toString()}`)
}

function assertIsDefined<T>(thing: T): NonNullable<T> {
  if (thing == null) {
    throw new Error(`Expected value to be defined`)
  }

  return thing
}
