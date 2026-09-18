// =============================================================================
// Core Type Definitions
// =============================================================================

/**
 * The AI backends the generator can call. Declared once here because this union
 * used to be spelled out literally in eight places, and adding a provider meant
 * finding all of them. `ProviderName` in `lib/ai/provider.ts` aliases this.
 */
export type AIProvider = 'gemini' | 'groq' | 'nvidia' | 'openrouter'

export interface RegionLockState {
  layout: boolean
  style: boolean
  animation: boolean
}

export interface RegionGeometry {
  x: number
  y: number
  width: number
  height: number
  type: 'rectangle' | 'circle' | 'freeform' | 'arrow'
  path?: Array<{ x: number; y: number }>
}

/**
 * A named set of regions sharing one description. Users draw a feature as many
 * shapes, then want to explain it once ("these 20 shapes are the pricing table")
 * instead of repeating themselves per shape.
 * Membership lives on `Region.groupId`, so deleting a region can't leave a
 * dangling reference behind.
 */
export interface RegionGroup {
  id: string
  name: string
  intent: string
  createdAt: string
  updatedAt: string
}

/** What gets persisted to `projects.canvas_data`. */
export interface CanvasData {
  regions: Region[]
  groups: RegionGroup[]
}

export interface Region {
  id: string
  regionNumber: number
  geometry: RegionGeometry
  intent: string
  groupId?: string | null
  classificationTag?: 'exact-placement' | 'approximate-area' | 'decorative' | 'relational'
  // For decorative regions: 'region' = confined to where it was drawn /
  // behind the region it overlaps; 'full' = whole-page background.
  backgroundScope?: 'region' | 'full'
  lockState: RegionLockState
  generatedCode: string | null
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  userId: string
  name: string
  regions: Region[]
  globalTheme: string | null
  canvasData: string | null
  generatedCode: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectSummary {
  id: string
  name: string
  regionCount: number
  updatedAt: string
  isPublic: boolean
}

export interface Generation {
  id: string
  regionId: string
  prompt: string
  generatedCode: string
  version: number
  provider: AIProvider
  createdAt: string
}

export type ViewMode = 'canvas' | 'preview'

export type CanvasTool = 'select' | 'rectangle' | 'circle' | 'freeform' | 'arrow'

export interface CanvasState {
  activeTool: CanvasTool
  selectedRegionIds: string[]
  regions: Region[]
  zoom: number
  isDrawing: boolean
  width: number
  height: number
}

export type WorkflowStatus =
  | 'idle'
  | 'drawing'
  | 'analyzing'
  | 'regions_ready'
  | 'generating'
  | 'preview_ready'
  | 'error'

export interface WorkflowState {
  status: WorkflowStatus
  errorMessage: string | null
  previewCode: string | null
  isRegenerating: boolean
  regeneratingRegionId: string | null
}

export interface Usage {
  id: string
  userId: string
  date: string
  generationCount: number
  maxGenerations: number
}

export interface GenerationResponse {
  success: boolean
  code?: string
  provider?: AIProvider
  error?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  createdAt: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}