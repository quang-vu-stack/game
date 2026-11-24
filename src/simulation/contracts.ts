export type ConstructionStage = 'foundation' | 'structure' | 'finishing' | 'complete'
export type WorkStatus = 'idle' | 'ready' | 'working' | 'waiting-materials' | 'complete'

export interface SiteSnapshot {
  readonly day: number
  readonly projectId: string | null
  readonly stage: ConstructionStage
  readonly progressPercent: number
  readonly materialLots: number
  readonly workStatus: WorkStatus
}

export interface SiteSceneOptions {
  readonly container: HTMLElement
  readonly onReport: (message: string) => void
}

export interface SiteScene {
  update(snapshot: SiteSnapshot): void
  dispose(): void
}

export type MountSite = (options: SiteSceneOptions) => SiteScene
