export type ToolType = 
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'circle'
  | 'diamond'
  | 'sticky'
  | 'pencil'
  | 'text'
  | 'arrow';

export interface ColorOption {
  value: string;
  label: string;
  isDarkText?: boolean;
}

export const PASTEL_COLORS: ColorOption[] = [
  { value: 'transparent', label: 'Transparent' },
  { value: '#ffffff', label: 'White' },
  { value: '#fef08a', label: 'Pastel Yellow' },
  { value: '#bbf7d0', label: 'Pastel Green' },
  { value: '#bae6fd', label: 'Pastel Blue' },
  { value: '#e9d5ff', label: 'Pastel Purple' },
  { value: '#fbcfe8', label: 'Pastel Pink' },
  { value: '#fed7aa', label: 'Pastel Orange' },
  { value: '#1e293b', label: 'Slate Dark', isDarkText: false },
];

export const STROKE_COLORS: ColorOption[] = [
  { value: '#1e293b', label: 'Black / Dark' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Rose' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ffffff', label: 'White' },
];

export interface Collaborator {
  id: string;
  nickname: string;
  color: string;
  x: number;
  y: number;
  lastActive: number;
}

export interface SelectedObjectState {
  id?: string;
  type?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDashArray?: number[] | null;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: string;
  opacity?: number;
  left: number;
  top: number;
  width: number;
  height: number;
}
