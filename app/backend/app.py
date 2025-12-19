"""
Energy Network Explorer - FastAPI Backend
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pypsa
import json
import numpy as np
from pathlib import Path
import tempfile
import shutil
import asyncio
from pydantic import BaseModel
from datetime import datetime

# Store loaded networks in memory
networks: dict[str, pypsa.Network] = {}

# Store active WebSocket connections
active_connections: list[WebSocket] = []

# Store optimization status
optimization_status: dict[str, dict] = {}

def clean_for_json(df):
    """Replace inf/-inf/nan with None for JSON serialization."""
    df = df.copy()
    for col in df.select_dtypes(include=[np.floating]).columns:
        df[col] = df[col].replace([np.inf, -np.inf], np.nan)
    # Convert to records, replacing NaN with None
    records = df.to_dict(orient="records")
    for record in records:
        for key, value in record.items():
            if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
                record[key] = None
    return records

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print(f"[Backend] Starting with PyPSA {pypsa.__version__}")
    yield
    print("[Backend] Shutting down")
    networks.clear()

app = FastAPI(title="Energy Network Explorer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "Energy Network Explorer API", "pypsa_version": pypsa.__version__}

@app.get("/health")
def health():
    return {"healthy": True}

@app.get("/networks")
def list_networks():
    """List all loaded networks."""
    return {
        "networks": [
            {
                "id": nid,
                "name": n.name or nid,
                "buses": len(n.buses),
                "generators": len(n.generators),
                "lines": len(n.lines),
                "loads": len(n.loads),
                "snapshots": len(n.snapshots),
            }
            for nid, n in networks.items()
        ]
    }

@app.post("/networks/load")
async def load_network(file: UploadFile = File(...)):
    """Load a network from uploaded file (.nc or .h5)."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    suffix = Path(file.filename).suffix.lower()
    if suffix not in [".nc", ".h5"]:
        raise HTTPException(400, f"Unsupported file type: {suffix}. Use .nc or .h5")

    # Save to temp file and load
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    
    try:
        n = pypsa.Network(tmp_path)
        network_id = file.filename.replace(suffix, "")
        networks[network_id] = n
        return {
            "id": network_id,
            "name": n.name or network_id,
            "buses": len(n.buses),
            "generators": len(n.generators),
            "lines": len(n.lines),
            "loads": len(n.loads),
            "snapshots": len(n.snapshots),
        }
    except Exception as e:
        raise HTTPException(400, f"Failed to load network: {str(e)}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)


class LoadPathRequest(BaseModel):
    path: str

@app.post("/networks/load-path")
def load_network_from_path(request: LoadPathRequest):
    """Load a network from a local file path (.nc or .h5)."""
    file_path = Path(request.path)
    
    if not file_path.exists():
        raise HTTPException(404, f"File not found: {request.path}")
    
    suffix = file_path.suffix.lower()
    if suffix not in [".nc", ".h5"]:
        raise HTTPException(400, f"Unsupported file type: {suffix}. Use .nc or .h5")
    
    try:
        n = pypsa.Network(str(file_path))
        network_id = file_path.stem
        networks[network_id] = n
        return {
            "id": network_id,
            "name": n.name or network_id,
            "buses": len(n.buses),
            "generators": len(n.generators),
            "lines": len(n.lines),
            "loads": len(n.loads),
            "snapshots": len(n.snapshots),
        }
    except Exception as e:
        raise HTTPException(400, f"Failed to load network: {str(e)}")

@app.post("/networks/example")
def load_example_network():
    """Load PyPSA example network."""
    n = pypsa.examples.ac_dc_meshed()
    network_id = "ac_dc_meshed"
    networks[network_id] = n
    return {
        "id": network_id,
        "name": n.name or network_id,
        "buses": len(n.buses),
        "generators": len(n.generators),
        "lines": len(n.lines),
        "loads": len(n.loads),
        "snapshots": len(n.snapshots),
    }

@app.get("/networks/{network_id}")
def get_network(network_id: str):
    """Get network summary."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    return {
        "id": network_id,
        "name": n.name or network_id,
        "buses": len(n.buses),
        "generators": len(n.generators),
        "lines": len(n.lines),
        "links": len(n.links),
        "loads": len(n.loads),
        "storage_units": len(n.storage_units),
        "stores": len(n.stores),
        "snapshots": len(n.snapshots),
    }

@app.get("/networks/{network_id}/buses")
def get_buses(network_id: str):
    """Get all buses in network."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    cols = ["x", "y", "v_nom", "carrier"]
    cols = [c for c in cols if c in n.buses.columns]
    df = n.buses[cols].copy()
    df.index.name = "name"
    return {"buses": clean_for_json(df.reset_index())}

@app.get("/networks/{network_id}/generators")
def get_generators(network_id: str):
    """Get all generators in network."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    cols = ["bus", "carrier", "p_nom", "p_nom_extendable", "marginal_cost", "capital_cost"]
    cols = [c for c in cols if c in n.generators.columns]
    df = n.generators[cols].copy()
    df.index.name = "name"
    return {"generators": clean_for_json(df.reset_index())}

@app.get("/networks/{network_id}/lines")
def get_lines(network_id: str):
    """Get all lines in network."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    cols = ["bus0", "bus1", "s_nom", "x", "r", "length"]
    cols = [c for c in cols if c in n.lines.columns]
    df = n.lines[cols].copy()
    df.index.name = "name"
    return {"lines": clean_for_json(df.reset_index())}

@app.get("/networks/{network_id}/loads")
def get_loads(network_id: str):
    """Get all loads in network."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    cols = ["bus", "carrier", "p_set"]
    cols = [c for c in cols if c in n.loads.columns]
    df = n.loads[cols].copy()
    df.index.name = "name"
    return {"loads": clean_for_json(df.reset_index())}

@app.get("/networks/{network_id}/links")
def get_links(network_id: str):
    """Get all links in network."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    if n.links.empty:
        return {"links": []}
    cols = ["bus0", "bus1", "p_nom", "carrier", "efficiency"]
    cols = [c for c in cols if c in n.links.columns]
    df = n.links[cols].copy()
    df.index.name = "name"
    return {"links": clean_for_json(df.reset_index())}

@app.delete("/networks/{network_id}")
def delete_network(network_id: str):
    """Unload a network from memory."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    del networks[network_id]
    return {"deleted": network_id}

async def broadcast(message: dict):
    """Broadcast message to all connected WebSocket clients."""
    for connection in active_connections:
        try:
            await connection.send_json(message)
        except Exception:
            pass

class OptimizeRequest(BaseModel):
    solver: str = "highs"

@app.post("/networks/{network_id}/optimize")
async def optimize_network(network_id: str, request: OptimizeRequest = OptimizeRequest()):
    """Run optimization on a network."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    
    if network_id in optimization_status and optimization_status[network_id].get("running"):
        raise HTTPException(400, f"Optimization already running for '{network_id}'")
    
    n = networks[network_id]
    
    # Initialize status
    optimization_status[network_id] = {
        "running": True,
        "progress": 0,
        "status": "starting",
        "started_at": datetime.now().isoformat(),
    }
    
    await broadcast({
        "type": "optimization_status",
        "network_id": network_id,
        "status": "starting",
        "progress": 0,
    })
    
    try:
        await broadcast({
            "type": "optimization_status", 
            "network_id": network_id,
            "status": "running",
            "progress": 10,
            "message": "Building optimization model...",
        })
        
        loop = asyncio.get_event_loop()
        
        def run_optimize():
            return n.optimize(solver_name=request.solver)
        
        await broadcast({
            "type": "optimization_status",
            "network_id": network_id, 
            "status": "running",
            "progress": 30,
            "message": "Solving optimization problem...",
        })
        
        status, termination = await loop.run_in_executor(None, run_optimize)
        
        await broadcast({
            "type": "optimization_status",
            "network_id": network_id,
            "status": "running", 
            "progress": 90,
            "message": "Extracting results...",
        })
        
        objective_obj = n.objective if hasattr(n, 'objective') else None
        objective = float(objective_obj) if objective_obj is not None else None
        
        optimization_status[network_id] = {
            "running": False,
            "progress": 100,
            "status": "completed",
            "termination": termination,
            "objective": objective,
            "completed_at": datetime.now().isoformat(),
        }
        
        await broadcast({
            "type": "optimization_status",
            "network_id": network_id,
            "status": "completed",
            "progress": 100,
            "termination": termination,
            "objective": objective,
        })
        
        return {
            "status": "completed",
            "termination": termination,
            "objective": objective,
        }
        
    except Exception as e:
        optimization_status[network_id] = {
            "running": False,
            "progress": 0,
            "status": "failed",
            "error": str(e),
        }
        
        await broadcast({
            "type": "optimization_status",
            "network_id": network_id,
            "status": "failed",
            "error": str(e),
        })
        
        raise HTTPException(500, f"Optimization failed: {str(e)}")

@app.get("/networks/{network_id}/optimization-status")
def get_optimization_status(network_id: str):
    """Get current optimization status."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    return optimization_status.get(network_id, {"status": "idle"})

@app.get("/networks/{network_id}/results")
def get_results(network_id: str):
    """Get optimization results."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    
    if not hasattr(n, 'objective') or n.objective is None:
        raise HTTPException(400, "Network has not been optimized yet")
    
    results = {
        "objective": float(n.objective) if n.objective else None,
        "generators_p_nom_opt": clean_for_json(
            n.generators[["bus", "carrier", "p_nom", "p_nom_opt"]].reset_index()
        ) if "p_nom_opt" in n.generators.columns else [],
        "lines_s_nom_opt": clean_for_json(
            n.lines[["bus0", "bus1", "s_nom", "s_nom_opt"]].reset_index()
        ) if "s_nom_opt" in n.lines.columns else [],
    }
    return results

class StatisticsRequest(BaseModel):
    statistic: str = "energy_balance"
    groupby: str = "carrier"
    
@app.post("/networks/{network_id}/statistics")
def get_statistics(network_id: str, request: StatisticsRequest):
    """Get network statistics using PyPSA's statistics module."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    
    allowed_statistics = [
        "energy_balance", "supply", "withdrawal", "curtailment",
        "capacity_factor", "revenue", "market_value", "optimal_capacity"
    ]
    
    if request.statistic not in allowed_statistics:
        raise HTTPException(400, f"Invalid statistic. Allowed: {allowed_statistics}")
    
    try:
        stat_func = getattr(n.statistics, request.statistic)
        result = stat_func(groupby=request.groupby)
        
        # Convert to JSON-serializable format
        if hasattr(result, 'to_dict'):
            return {"data": result.to_dict()}
        return {"data": result}
    except Exception as e:
        raise HTTPException(500, f"Failed to compute statistics: {str(e)}")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates."""
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            await websocket.send_json({"type": "ack", "received": msg})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
