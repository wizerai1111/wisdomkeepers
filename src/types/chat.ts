export interface Message {
  content: string;
  role: 'user' | 'assistant';
  type: 'text' | 'audio';
  timestamp: Date;
  audioUrl?: string;
  userId?: string;
} 