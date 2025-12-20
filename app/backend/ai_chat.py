"""
AI Chat Service for Energy Network Explorer

Uses llama.cpp server with Salesforce xLAM for tool calling.
Provides natural language interface to PyPSA network operations.
"""

import json
import httpx
from typing import Any
from dataclasses import dataclass
from enum import Enum

# LLM Server configuration
LLM_BASE_URL = "http://localhost:8080/v1"
LLM_MODEL = "xLAM"


class ToolApprovalRequired(Exception):
    """Raised when a tool requires human approval before execution."""
    def __init__(self, tool_name: str, arguments: dict, tool_call_id: str):
        self.tool_name = tool_name
        self.arguments = arguments
        self.tool_call_id = tool_call_id
        super().__init__(f"Tool '{tool_name}' requires approval")


# Define which tools need human approval (dangerous operations)
DANGEROUS_TOOLS = {"run_optimization", "delete_network"}


# Tool definitions for the LLM
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_network_summary",
            "description": "Get a summary of a loaded energy network including counts of buses, generators, lines, loads, and snapshots",
            "parameters": {
                "type": "object",
                "properties": {
                    "network_id": {
                        "type": "string",
                        "description": "The ID of the network to summarize"
                    }
                },
                "required": ["network_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_networks",
            "description": "List all currently loaded networks with their basic info",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_generators_summary",
            "description": "Get aggregated statistics about generators in a network, grouped by carrier type",
            "parameters": {
                "type": "object",
                "properties": {
                    "network_id": {
                        "type": "string",
                        "description": "The ID of the network"
                    }
                },
                "required": ["network_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_optimization_status",
            "description": "Get the current status of optimization for a network (idle, queued, running, completed, failed)",
            "parameters": {
                "type": "object",
                "properties": {
                    "network_id": {
                        "type": "string",
                        "description": "The ID of the network"
                    }
                },
                "required": ["network_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_optimization",
            "description": "Queue an optimization job for a network. This is a LONG RUNNING operation that optimizes power flow. REQUIRES USER APPROVAL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "network_id": {
                        "type": "string",
                        "description": "The ID of the network to optimize"
                    },
                    "solver": {
                        "type": "string",
                        "enum": ["highs", "glpk"],
                        "description": "The solver to use (default: highs)"
                    }
                },
                "required": ["network_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "load_example_network",
            "description": "Load the PyPSA example network (ac_dc_meshed) for demonstration",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_optimization_results",
            "description": "Get the results of a completed optimization including objective value and optimal capacities",
            "parameters": {
                "type": "object",
                "properties": {
                    "network_id": {
                        "type": "string",
                        "description": "The ID of the network"
                    }
                },
                "required": ["network_id"]
            }
        }
    },
]


@dataclass
class ChatMessage:
    role: str  # "user", "assistant", "tool"
    content: str | None
    tool_calls: list[dict] | None = None
    tool_call_id: str | None = None


class ChatSession:
    """Manages a chat session with conversation history."""
    
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.messages: list[dict] = []
        self.backend_url = backend_url
        self.pending_approval: dict | None = None  # Tool awaiting approval
        
        # System message
        self.messages.append({
            "role": "system",
            "content": """You are an AI assistant that helps users with energy network analysis.

CRITICAL: You MUST use tools to perform ANY action. NEVER pretend to do something - ALWAYS call the appropriate tool.

When user says "load example" -> call load_example_network
When user asks about a network -> call get_network_summary  
When user asks about generators -> call get_generators_summary
When user wants optimization -> call run_optimization
When user asks what networks exist -> call list_networks"""
        })
    
    async def _call_llm(self, with_tools: bool = True) -> dict:
        """Call the LLM server."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            payload = {
                "model": LLM_MODEL,
                "messages": self.messages,
                "max_tokens": 500,
                "temperature": 0.1,
            }
            if with_tools:
                payload["tools"] = TOOLS
                payload["tool_choice"] = "auto"
            
            response = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                json=payload
            )
            response.raise_for_status()
            return response.json()
    
    async def _execute_tool(self, tool_name: str, arguments: dict) -> str:
        """Execute a tool by calling the backend API."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                if tool_name == "get_network_summary":
                    network_id = arguments.get("network_id")
                    resp = await client.get(f"{self.backend_url}/networks/{network_id}")
                    if resp.status_code == 404:
                        return json.dumps({"error": f"Network '{network_id}' not found"})
                    return resp.text
                
                elif tool_name == "list_networks":
                    resp = await client.get(f"{self.backend_url}/networks")
                    data = resp.json()
                    networks = data.get("networks", [])
                    if not networks:
                        return json.dumps({"message": "No networks loaded", "networks": []})
                    # Return summary, not full data
                    return json.dumps({
                        "count": len(networks),
                        "networks": [{"id": n["id"], "buses": n["buses"], "generators": n["generators"]} for n in networks]
                    })
                
                elif tool_name == "get_generators_summary":
                    network_id = arguments.get("network_id")
                    resp = await client.get(f"{self.backend_url}/networks/{network_id}/generators")
                    if resp.status_code == 404:
                        return json.dumps({"error": f"Network '{network_id}' not found"})
                    data = resp.json()
                    generators = data.get("generators", [])
                    # Aggregate by carrier
                    by_carrier = {}
                    total_capacity = 0
                    for gen in generators:
                        carrier = gen.get("carrier", "unknown")
                        p_nom = gen.get("p_nom", 0) or 0
                        if carrier not in by_carrier:
                            by_carrier[carrier] = {"count": 0, "total_p_nom": 0}
                        by_carrier[carrier]["count"] += 1
                        by_carrier[carrier]["total_p_nom"] += p_nom
                        total_capacity += p_nom
                    return json.dumps({
                        "total_generators": len(generators),
                        "total_capacity_mw": round(total_capacity, 2),
                        "by_carrier": by_carrier
                    })
                
                elif tool_name == "get_optimization_status":
                    network_id = arguments.get("network_id")
                    resp = await client.get(f"{self.backend_url}/networks/{network_id}/optimization-status")
                    if resp.status_code == 404:
                        return json.dumps({"error": f"Network '{network_id}' not found"})
                    return resp.text
                
                elif tool_name == "run_optimization":
                    network_id = arguments.get("network_id")
                    solver = arguments.get("solver", "highs")
                    resp = await client.post(
                        f"{self.backend_url}/networks/{network_id}/optimize",
                        json={"solver": solver}
                    )
                    if resp.status_code == 404:
                        return json.dumps({"error": f"Network '{network_id}' not found"})
                    if resp.status_code == 400:
                        return json.dumps({"error": resp.json().get("detail", "Already running")})
                    return resp.text
                
                elif tool_name == "load_example_network":
                    resp = await client.post(f"{self.backend_url}/networks/example")
                    return resp.text
                
                elif tool_name == "get_optimization_results":
                    network_id = arguments.get("network_id")
                    resp = await client.get(f"{self.backend_url}/networks/{network_id}/results")
                    if resp.status_code == 404:
                        return json.dumps({"error": f"Network '{network_id}' not found"})
                    if resp.status_code == 400:
                        return json.dumps({"error": "Network has not been optimized yet"})
                    data = resp.json()
                    # Summarize results instead of returning raw data
                    return json.dumps({
                        "objective": data.get("objective"),
                        "generators_optimized": len(data.get("generators_p_nom_opt", [])),
                        "lines_optimized": len(data.get("lines_s_nom_opt", []))
                    })
                
                else:
                    return json.dumps({"error": f"Unknown tool: {tool_name}"})
                    
            except httpx.ConnectError:
                return json.dumps({"error": "Backend server not available"})
            except Exception as e:
                return json.dumps({"error": str(e)})
    
    async def chat(self, user_message: str) -> dict:
        """
        Process a user message and return the response.
        
        Returns:
            dict with keys:
            - "response": str - The assistant's response
            - "needs_approval": bool - Whether a tool needs approval
            - "pending_tool": dict | None - Tool details if needs_approval
        """
        # Check if we're resuming after approval
        if self.pending_approval:
            if user_message.lower() in ["yes", "y", "approve", "ok", "do it"]:
                # Execute the approved tool
                tool = self.pending_approval
                self.pending_approval = None
                
                result = await self._execute_tool(tool["name"], tool["arguments"])
                
                # Add tool result to messages
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool["tool_call_id"],
                    "content": result
                })
                
                # Get final response from LLM
                llm_response = await self._call_llm(with_tools=False)
                assistant_content = llm_response["choices"][0]["message"]["content"]
                
                self.messages.append({
                    "role": "assistant",
                    "content": assistant_content
                })
                
                return {
                    "response": assistant_content,
                    "needs_approval": False,
                    "pending_tool": None
                }
            
            elif user_message.lower() in ["no", "n", "cancel", "nevermind"]:
                tool = self.pending_approval
                self.pending_approval = None
                
                # Add rejection as tool result
                self.messages.append({
                    "role": "tool",
                    "tool_call_id": tool["tool_call_id"],
                    "content": json.dumps({"status": "cancelled", "message": "User cancelled the operation"})
                })
                
                return {
                    "response": f"Okay, I won't run {tool['name']}.",
                    "needs_approval": False,
                    "pending_tool": None
                }
        
        # Add user message
        self.messages.append({"role": "user", "content": user_message})
        
        # Call LLM
        try:
            llm_response = await self._call_llm()
        except httpx.ConnectError:
            return {
                "response": "I can't connect to the LLM server. Please make sure it's running (./llm-server/scripts/start.sh)",
                "needs_approval": False,
                "pending_tool": None
            }
        
        assistant_message = llm_response["choices"][0]["message"]
        
        # Check for tool calls
        if assistant_message.get("tool_calls"):
            tool_call = assistant_message["tool_calls"][0]
            tool_name = tool_call["function"]["name"]
            tool_args = json.loads(tool_call["function"]["arguments"])
            tool_call_id = tool_call.get("id", "call_1")
            
            # Add assistant message with tool call
            self.messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [tool_call]
            })
            
            # Check if tool needs approval
            if tool_name in DANGEROUS_TOOLS:
                self.pending_approval = {
                    "name": tool_name,
                    "arguments": tool_args,
                    "tool_call_id": tool_call_id
                }
                
                # Format approval request
                if tool_name == "run_optimization":
                    network_id = tool_args.get("network_id", "unknown")
                    solver = tool_args.get("solver", "highs")
                    approval_msg = f"I'll run optimization on '{network_id}' using {solver} solver. This may take a while. Proceed? (yes/no)"
                else:
                    approval_msg = f"Do you want me to execute {tool_name}? (yes/no)"
                
                return {
                    "response": approval_msg,
                    "needs_approval": True,
                    "pending_tool": {
                        "name": tool_name,
                        "arguments": tool_args
                    }
                }
            
            # Execute safe tool immediately
            result = await self._execute_tool(tool_name, tool_args)
            
            # Add tool result
            self.messages.append({
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": result
            })
            
            # Get final response
            llm_response = await self._call_llm(with_tools=False)
            assistant_content = llm_response["choices"][0]["message"]["content"]
            
            self.messages.append({
                "role": "assistant",
                "content": assistant_content
            })
            
            return {
                "response": assistant_content,
                "needs_approval": False,
                "pending_tool": None,
                "tool_executed": {
                    "name": tool_name,
                    "arguments": tool_args
                }
            }
        
        # No tool calls - direct response
        assistant_content = assistant_message.get("content", "")
        self.messages.append({
            "role": "assistant",
            "content": assistant_content
        })
        
        return {
            "response": assistant_content,
            "needs_approval": False,
            "pending_tool": None
        }


# Global chat sessions (keyed by session_id)
chat_sessions: dict[str, ChatSession] = {}


def get_or_create_session(session_id: str, backend_url: str = "http://localhost:8000") -> ChatSession:
    """Get existing session or create new one."""
    if session_id not in chat_sessions:
        chat_sessions[session_id] = ChatSession(backend_url=backend_url)
    return chat_sessions[session_id]


def clear_session(session_id: str):
    """Clear a chat session."""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
