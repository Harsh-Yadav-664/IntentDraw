// =============================================================================
// Core Type Definitions
// =============================================================================

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

export interface Region {
  id: string
  regionNumber: number
  geometry: RegionGeometry
  intent: string
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
  provider: 'gemini' | 'groq'
  createdAt: string
}

export type CanvasTool = 'select' | 'rectangle' | 'circle' | 'freeform' | 'arrow'

export interface CanvasState {
  activeTool: CanvasTool
  selectedRegionId: string | null
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

export interface AnalysisResponse {
  success: boolean
  regions?: Array<{
    regionNumber: number
    boundingBox: { x: number; y: number; width: number; height: number }
    shapeType: 'rectangle' | 'circle' | 'freeform' | 'arrow'
    suggestedPurpose: string
  }>
  error?: string
}

export interface GenerationResponse {
  success: boolean
  code?: string
  provider?: 'gemini' | 'groq'
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