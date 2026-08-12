export interface ApiTokenProvider {
  load(): Promise<string>;
}
