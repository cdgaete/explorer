import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, Trash2, Loader2, AlertCircle, CheckCircle2, XCircle, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useChatStore, ChatMessage as ChatMessageType } from '@/stores/chatStore'
import { useChatWebSocket } from '@/hooks/useChatWebSocket'
import { cn } from '@/lib/utils'

function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'

  // Tool execution message - compact style
  if (isTool) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/30">
        <Wrench className="h-3 w-3" />
        <span>{message.content}</span>
        <CheckCircle2 className="h-3 w-3 text-green-500" />
      </div>
    )
  }

  return (
    <div className={cn(
      "flex gap-3 p-3",
      isUser && "bg-muted/50",
    )}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      )}>
        {isUser ? "U" : "AI"}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-sm whitespace-pre-wrap break-words",
          isSystem && "text-muted-foreground italic"
        )}>
          {message.content}
        </div>
        {message.needsApproval && (
          <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3" />
            <span>Awaiting your approval (reply yes/no)</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-1">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 p-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted text-muted-foreground text-xs font-medium">
        AI
      </div>
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs",
      isConnected ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
    )}>
      {isConnected ? (
        <>
          <CheckCircle2 className="h-3 w-3" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <XCircle className="h-3 w-3" />
          <span>Disconnected</span>
        </>
      )}
    </div>
  )
}

export function RightPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { messages, isConnected, isTyping, error } = useChatStore()
  const { sendMessage, clearChat } = useChatWebSocket()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || !isConnected) return
    
    sendMessage(trimmed)
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <h2 className="text-sm font-medium">AI Assistant</h2>
        <div className="ml-auto flex items-center gap-2">
          <ConnectionStatus isConnected={isConnected} />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearChat}
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Ask me about your energy networks
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• "Load the example network"</p>
              <p>• "What generators are available?"</p>
              <p>• "Run optimization"</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isTyping && <TypingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Ask about your network..." : "Connecting..."}
            disabled={!isConnected}
            className={cn(
              "flex-1 px-3 py-2 text-sm rounded-md border border-border bg-background",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!isConnected || !input.trim() || isTyping}
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
