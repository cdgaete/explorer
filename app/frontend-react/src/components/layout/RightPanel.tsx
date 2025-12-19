import { MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RightPanel() {
  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        <h2 className="text-sm font-medium">AI Assistant</h2>
        <span className="text-xs text-muted-foreground ml-auto">Phase 4</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">AI Chat Coming Soon</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          Chat with an AI assistant to analyze networks, run optimizations, and explore results using natural language.
        </p>
        <ul className="text-xs text-muted-foreground text-left space-y-1">
          <li>• "Load the German network example"</li>
          <li>• "Run optimization with HiGHS solver"</li>
          <li>• "Show me generators by carrier type"</li>
          <li>• "What's the total generation capacity?"</li>
        </ul>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask about your network..."
            disabled
            className="flex-1 px-3 py-2 text-sm rounded-md bg-muted border border-border text-muted-foreground"
          />
          <Button size="sm" disabled>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
