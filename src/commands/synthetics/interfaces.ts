import {Metadata} from '../../helpers/interfaces'
import {ProxyConfiguration} from '../../helpers/utils'

import {RecursivePartial} from './base-command'
import {TunnelInfo} from './tunnel'

export type SupportedReporter = 'junit' | 'default'

export interface MainReporter {
  log(log: string): void
  error(error: string): void
  initErrors(errors: string[]): void
  testTrigger(test: Test, testId: string, executionRule: ExecutionRule, testOverrides: UserConfigOverride): void
  testWait(test: Test): void
  testsWait(tests: Test[], baseUrl: string, batchId: string, skippedCount?: number): void
  resultReceived(result: ResultInBatch): void
  resultEnd(result: Result, baseUrl: string, batchId: string): void
  reportStart(timings: {startTime: number}): void
  runEnd(summary: Summary, baseUrl: string, orgSettings?: SyntheticsOrgSettings): void
}

export type Reporter = Partial<MainReporter>

export interface BaseServerResult {
  id: string
  status: 'passed' | 'failed' | 'skipped'
  failure?: {
    code: string
    message: string
  }
  unhealthy?: boolean
  finished_at: number
}

export interface Device {
  id: string
  resolution: {
    width: number
    height: number
  }
}

export interface BrowserServerResult extends BaseServerResult {
  duration: number
  start_url: string
  steps: Step[]
}

interface AssertionResult {
  actual: any
  expected?: any
  valid: boolean
}

export interface ApiServerResult extends BaseServerResult {
  assertions: AssertionResult[]
  timings: {
    total: number
  }
}

export interface MultiStep {
  allow_failure: boolean
  assertion_results: AssertionResult[]
  failure?: {
    code: string
    message: string
  }
  name: string
  status: 'passed' | 'failed' | 'skipped'
  subtype: string
  timings: {
    total: number
  }
}

export interface MultiStepsServerResult extends BaseServerResult {
  duration: number
  steps: MultiStep[]
}

export type ServerResult = BrowserServerResult | ApiServerResult | MultiStepsServerResult

export interface RawPollResult {
  data: {
    id: string
    type: string
    attributes: Omit<PollResult, 'test'>
    relationships: {
      test: {
        data: {
          id: string
          type: string
        }
      }
    }
  }[]
  included: {
    type: string
    id: string
    attributes: Pick<RawPollResultTest, 'type' | 'subtype' | 'config'>
  }[]
}

export interface RawPollResultTest {
  id: string
  type: 'browser' | 'api' | 'mobile'
  subtype?: string
  config: {
    request?: {
      dns_server?: string | undefined
    }
  }
}

export type PollResult = {
  test_type: 'api' | 'browser' | 'mobile'
  test: RecursivePartial<Test>
  result?: ServerResult
  resultID: string
  device?: Device
}

/**
 * Information required to convert a `PollResult` to a `Result`.
 */
export type ResultDisplayInfo = {
  getLocation: (datacenterId: string, test: Test) => string
  options: {
    batchTimeout: number
    datadogSite: string
    failOnCriticalErrors?: boolean
    failOnTimeout?: boolean
    subdomain: string
  }
  tests: Test[]
}

export type SelectiveRerunDecision =
  | {
      decision: 'run'
      reason: 'in_progress'
    }
  | {
      decision: 'run'
      reason: 'failed'
      linked_result_id: string
    }
  | {
      decision: 'run'
      reason: 'edited'
    }
  | {
      decision: 'run'
      reason: 'new'
    }
  | {
      decision: 'skip'
      reason: 'passed'
      linked_result_id: string
    }

// Note: We derive this summary into outputs in CI integrations.
// - The `batchId` is transformed into a `batchUrl` (which is more useful for users)
// - The `skipped` property is renamed to `testsSkippedCount`.
// - The `testsNotFound` is transformed into a `testsNotFoundCount`.
// - All properties are suffixed with `Count`.
//
// See:
// - https://github.com/DataDog/synthetics-ci-github-action#outputs
// - https://github.com/DataDog/datadog-ci-azure-devops#outputs
export interface Summary {
  /** The ID of the CI batch that was started by this datadog-ci execution. */
  batchId: string
  /** The number of critical errors that occurred during the CI batch. */
  criticalErrors: number
  /** The number of results expected by datadog-ci, prior to any selective rerun. */
  expected: number
  /** The number of results that failed during the CI batch. */
  failed: number
  /** The number of results that failed during the CI batch without blocking the CI. */
  failedNonBlocking: number
  /** The metadata collected for the CI batch. */
  metadata?: Metadata
  /** The number of results that passed during the CI batch. */
  passed: number
  /** The number of results that already passed in previous CI batches on the same commit. */
  previouslyPassed: number
  /** The number of tests that were skipped when starting the CI batch. */
  skipped: number
  /** The public IDs of tests that could not be accessed due to permissions when starting the CI batch. */
  testsNotAuthorized: Set<string>
  /** The public IDs of tests that could not be found when starting the CI batch. */
  testsNotFound: Set<string>
  /** The number of results that failed due to the CI batch timing out. */
  timedOut: number // XXX: When a batch times out, all the results that were in progress are timed out.
}

// Note: This is exposed in CI integrations as a JSON-encoded string in the `rawResults` output.
export interface BaseResult {
  /** The device used in this test run. */
  device?: Device
  /** Duration of this test run in milliseconds. */
  duration: number
  /** The execution rule that was used for this test run. */
  executionRule: ExecutionRule
  /** The ID of the initial attempt if this test run is a retry. */
  initialResultId?: string
  /** Whether this test run is intermediary and expected to be retried. */
  isNonFinal?: boolean
  /** The location from which this test run was executed. */
  location: string
  /** Whether this test run passed, taking into account `failOnCriticalErrors` and `failOnTimeout`. */
  passed: boolean
  /** Raw information about the test run. May not always be present. */
  result?: ServerResult
  /** The ID of this test run. */
  resultId: string
  /** The number of retries, including this test run. */
  retries: number
  /** The maximum number of retries for this test run. */
  maxRetries: number
  /** Information about the selective rerun that was applied to this test run. */
  selectiveRerun?: SelectiveRerunDecision
  /** The test that was run, including any overrides. */
  test: Test
  /** Whether this test run timed out. */
  timedOut: boolean
  /** The timestamp of this test run. */
  timestamp: number
}

// Inside this type, `.resultId` is a linked result ID from a previous batch.
export type ResultSkippedBySelectiveRerun = Omit<
  BaseResult,
  'duration' | 'location' | 'result' | 'retries' | 'maxRetries' | 'timestamp'
> & {
  executionRule: ExecutionRule.SKIPPED
  selectiveRerun: Extract<SelectiveRerunDecision, {decision: 'skip'}>
}

export type Result = BaseResult | ResultSkippedBySelectiveRerun

type Status = 'passed' | 'failed' | 'in_progress' | 'skipped'
type BatchStatus = 'passed' | 'failed' | 'in_progress'

export interface BaseResultInBatch {
  duration: number
  execution_rule: ExecutionRule
  initial_result_id?: string
  location: string
  result_id: string
  retries: number | null
  max_retries: number | null
  selective_rerun?: SelectiveRerunDecision
  status: Status
  test_public_id: string
  timed_out: boolean | null
}

type SkippedResultInBatch = Omit<BaseResultInBatch, 'duration' | 'location' | 'result_id'> & {
  execution_rule: ExecutionRule.SKIPPED
  status: 'skipped'
}

export type ResultInBatchSkippedBySelectiveRerun = SkippedResultInBatch & {
  selective_rerun: Extract<SelectiveRerunDecision, {decision: 'skip'}>
}

export type ResultInBatch = BaseResultInBatch | ResultInBatchSkippedBySelectiveRerun

export interface Batch {
  results: ResultInBatch[]
  status: BatchStatus
}

type ServerResultInBatch = BaseResultInBatch | SkippedResultInBatch

export interface ServerBatch {
  // The batch from the server contains skipped results, which we're going to remove since we don't
  // care about skipped results internally (except when they are skipped by a selective rerun).
  results: ServerResultInBatch[]
  status: BatchStatus
}

export interface Vitals {
  cls?: number
  lcp?: number
  url: string
}

export interface BrowserError {
  description: string
  name: string
  type: string
}

export interface Step {
  allow_failure: boolean
  browser_errors: BrowserError[]
  description: string
  duration: number
  failure?: {
    code?: string
    message: string
  }
  public_id?: string
  status: string
  id?: number // Navigation step has no id
  element_updates?: {
    multi_locator?: MultiLocator
  }
  sub_test_public_id?: string
  sub_test_step_details?: Step[]
  type: string
  url: string
  value?: string | number
  vitals_metrics: Vitals[]
  warnings?: {
    message: string
    type: string
  }[]
}

export interface MultiLocator {
  [key: string]: unknown
}

// TODO SYNTH-17944 Remove unsupported fields

export interface TestStepWithUnsupportedFields {
  public_id?: string
  params: {
    element?: {
      multiLocator?: MultiLocator
      userLocator?: unknown
    }
  }
}

export interface LocalTestDefinition {
  config: {
    assertions: Assertion[]
    request?: {
      dnsServer?: string
      headers: {[key: string]: string}
      host?: string
      method: string
      port?: number
      timeout: number
      url: string
    }
    steps?: {subtype: string}[] // For multistep API tests
    variables: string[]
  }
  locations: string[]
  name: string
  options: OptionsWithUnsupportedFields
  /** Can be used to link to an existing remote test. */
  public_id?: string
  subtype?: string // This is optional in the browser and api schemas
  steps?: TestStepWithUnsupportedFields[] // From browser schema
  type: 'api' | 'browser' | 'mobile'
}

interface Options {
  ci?: {
    executionRule: ExecutionRule
  }
  device_ids?: string[]
  mobileApplication?: MobileApplication
  retry?: {
    count?: number
  }
}

// TODO SYNTH-17944 Remove unsupported fields

export interface OptionsWithUnsupportedFields extends Options {
  bindings?: null | unknown[]
  min_failure_duration?: number
  min_location_failed?: any
  monitor_name?: string
  monitor_options?: any
  monitor_priority?: number
  tick_every?: number
}

// TODO SYNTH-17944 Remove unsupported fields
// I think a bunch of these are front-end specific fields
interface LocalTestDefinitionWithUnsupportedFields extends LocalTestDefinition {
  created_at?: any
  created_by?: any
  creator?: any
  creation_source?: string
  message?: string
  modified_at?: any
  modified_by?: any
  monitor_id?: number
  overall_state?: any
  overall_state_modified?: any
  status?: string
  stepCount?: any
  tags?: string[]
  version?: any
  version_uuid?: any
}
export interface ServerTest extends LocalTestDefinitionWithUnsupportedFields {
  monitor_id: number
  status: 'live' | 'paused'
  public_id: string
}

export type Test = (ServerTest | LocalTestDefinitionWithUnsupportedFields) & {
  suite?: string
}

export interface Assertion {
  actual: string | number | Date | {[key: string]: any}
  errorMessage?: string
  operator: Operator
  property?: string
  target: string | number | Date | {[key: string]: any}
  type: string
  valid: boolean
}

export enum Operator {
  contains = 'contains',
  doesNotContain = 'doesNotContain',
  is = 'is',
  isNot = 'isNot',
  isInLessThan = 'isInLessThan',
  isInMoreThan = 'isInMoreThan',
  lessThan = 'lessThan',
  lessThanOrEqual = 'lessThanOrEqual',
  moreThan = 'moreThan',
  moreThanOrEqual = 'moreThanOrEqual',
  matches = 'matches',
  doesNotMatch = 'doesNotMatch',
  validatesJSONPath = 'validatesJSONPath',
  validatesXPath = 'validatesXPath',
}

export interface Location {
  display_name: string
  id: number
  is_active: boolean
  name: string
  region: string
}

export interface LocationsMapping {
  [key: string]: string
}

export interface ServerTrigger {
  batch_id: string
  locations: Location[]
  selective_rerun_rate_limited?: boolean
}

export interface TriggerInfo {
  batchId: string
  locations: Location[]
  selectiveRerunRateLimited?: boolean
  testsNotAuthorized: Set<string>
}

export interface RetryConfig {
  count: number
  interval: number
}

export interface MobileApplication {
  applicationId: string
  referenceId: string
  referenceType: 'latest' | 'version' | 'temporary'
}

export interface CookiesObject {
  append?: boolean
  value: string
}

export interface BaseConfigOverride {
  allowInsecureCertificates?: boolean
  basicAuth?: BasicAuthCredentials
  body?: string
  bodyType?: string
  cookies?: string | CookiesObject
  setCookies?: string | CookiesObject
  defaultStepTimeout?: number
  deviceIds?: string[]
  executionRule?: ExecutionRule
  followRedirects?: boolean
  headers?: {[key: string]: string}
  locations?: string[]
  resourceUrlSubstitutionRegexes?: string[]
  retry?: RetryConfig
  startUrl?: string
  startUrlSubstitutionRegex?: string
  testTimeout?: number
  variables?: {[key: string]: string}
}

export interface UserConfigOverride extends BaseConfigOverride {
  mobileApplicationVersion?: string
  mobileApplicationVersionFilePath?: string
}

export interface ServerConfigOverride extends BaseConfigOverride {
  mobileApplication?: MobileApplication
  appExtractedMetadata?: MobileAppExtractedMetadata
  // XXX: This would be better passed as a batch option in the future since it's always the same for all tests.
  tunnel?: TunnelInfo
}

export interface BatchOptions {
  batch_timeout?: number
  selective_rerun?: boolean
}

export interface Payload {
  metadata?: Metadata
  tests: TestPayload[]
  options?: BatchOptions
}

export interface LocalTestPayload extends ServerConfigOverride {
  local_test_definition: LocalTestDefinition
}
export interface RemoteTestPayload extends ServerConfigOverride {
  public_id: string
}
export type TestPayload = LocalTestPayload | RemoteTestPayload

/** Missing test, either because it's not found, or because it could not be read. */
export interface TestMissing {
  errorMessage: string
}

export interface TestSkipped {
  overriddenConfig: TestPayload
}

export interface TestWithOverride {
  test: Test
  overriddenConfig: TestPayload
}

export interface MobileTestWithOverride extends TestWithOverride {
  test: Test & {
    type: 'mobile'
    options: {
      mobileApplication: MobileApplication
    }
  }
}

export interface BasicAuthCredentials {
  password: string
  username: string
}

interface BaseTriggerConfig {
  testOverrides?: UserConfigOverride
  suite?: string
}
export interface RemoteTriggerConfig extends BaseTriggerConfig {
  id: string
}
export interface LocalTriggerConfig extends BaseTriggerConfig {
  localTestDefinition: LocalTestDefinition
}
export type TriggerConfig = RemoteTriggerConfig | LocalTriggerConfig

export enum ExecutionRule {
  BLOCKING = 'blocking',
  NON_BLOCKING = 'non_blocking',
  SKIPPED = 'skipped',
}

export interface Suite {
  content: {
    tests: TriggerConfig[]
  }
  name?: string
}

export interface TestConfig {
  tests: TriggerConfig[]
}

export interface TestSearchResult {
  tests: {
    public_id: string
  }[]
}

export interface APIConfiguration {
  apiKey: string
  appKey: string
  baseIntakeUrl: string
  baseUnstableUrl: string
  baseV1Url: string
  baseV2Url: string
  proxyOpts: ProxyConfiguration
}

export interface APIHelperConfig {
  apiKey: string
  appKey: string
  datadogSite: string
  proxy: ProxyConfiguration
}

export interface DatadogCIConfig extends APIHelperConfig {
  configPath: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SyntheticsCIConfig extends DatadogCIConfig {}

export interface RunTestsCommandConfig extends SyntheticsCIConfig {
  batchTimeout?: number
  buildCommand?: string
  defaultTestOverrides?: UserConfigOverride
  failOnCriticalErrors: boolean
  failOnMissingTests: boolean
  failOnTimeout: boolean
  files: string[]
  jUnitReport?: string
  mobileApplicationVersionFilePath?: string
  publicIds: string[]
  /** Whether to only run the tests which failed in the previous test batches. By default, the organization default setting is used. */
  selectiveRerun?: boolean
  /** Used to create URLs to the Datadog UI. */
  subdomain: string
  testSearchQuery?: string
  tunnel: boolean
}

export type WrapperConfig = Partial<RunTestsCommandConfig>

export interface UploadApplicationCommandConfig extends SyntheticsCIConfig {
  configPath: string
  mobileApplicationVersionFilePath?: string
  mobileApplicationId?: string
  versionName?: string
  latest?: boolean
}

export interface MobileApplicationUploadPart {
  partNumber: number
  md5: string
  blob: Buffer
}

export interface MobileApplicationUploadPartResponse {
  PartNumber: number
  ETag: string
}

export interface MultipartPresignedUrlsResponse {
  file_name: string
  multipart_presigned_urls_params: {
    key: string
    upload_id: string
    urls: {
      [key: string]: string
    }
  }
}

export type MobileApplicationNewVersionParams = {
  originalFileName: string
  versionName: string
  isLatest: boolean
}

export type AppUploadDetails = {appId: string; appPath: string; versionName?: string}

type MobileAppValidationStatus = 'pending' | 'complete' | 'error' | 'user_error'

type MobileInvalidAppResult = {
  invalid_reason: string
  invalid_message: string
}

export type MobileAppExtractedMetadata = Record<string, unknown>

type MobileValidAppResult = {
  extracted_metadata: MobileAppExtractedMetadata
  app_version_uuid: string
}

type MobileUserErrorResult = {
  user_error_reason: string
  user_error_message: string
}

export type MobileAppUploadResult = {
  status: MobileAppValidationStatus
  is_valid?: boolean
  org_uuid?: string
  invalid_app_result?: MobileInvalidAppResult
  valid_app_result?: MobileValidAppResult
  user_error_result?: MobileUserErrorResult
}

// Not the entire response, but only what's needed.
export interface SyntheticsOrgSettings {
  onDemandConcurrencyCap: number
}

export interface MobileApplicationVersion {
  id?: string
  application_id: string
  file_name: string
  original_file_name: string
  is_latest: boolean
  version_name: string
  created_at?: string
}

export interface ImportTestsCommandConfig extends SyntheticsCIConfig {
  configPath: string
  files: string[]
  publicIds: string[]
  testSearchQuery?: string
}

export interface DeployTestsCommandConfig extends SyntheticsCIConfig {
  configPath: string
  excludeFields?: string[]
  files: string[]
  publicIds: string[]
  subdomain: string
}
