import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: Date
  needsApproval?: boolean
  pendingTool?: {
    name: string
    arguments: Record<string, unknown>
  }
  toolName?: string  // For tool messages
}

interface ChatState {
  messages: ChatMessage[]
  isConnected: boolean
  isTyping: boolean
  error: string | null

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  setTyping: (typing: boolean) => void
  setConnected: (connected: boolean) => void
  setError: (error: string | null) => void
  clearMessages: () => void
}

let messageId = 0

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isConnected: false,
  isTyping: false,
  error: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg-${++messageId}`,
          timestamp: new Date(),
        },
      ],
    })),

  setTyping: (typing) => set({ isTyping: typing }),

  setConnected: (connected) => set({ isConnected: connected }),

  setError: (error) => set({ error }),

  clearMessages: () => set({ messages: [], error: null }),
}))
