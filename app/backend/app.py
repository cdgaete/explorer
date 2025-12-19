"""
Energy Network Explorer - FastAPI Backend
"""
from fastapi import FastAPI, WebSocket, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pypsa
import json
from pathlib import Path
import tempfile
import shutil

# Store loaded networks in memory
networks: dict[str, pypsa.Network] = {}

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
    df = n.buses[["x", "y", "v_nom", "carrier"]].copy()
    df.index.name = "name"
    return {"buses": df.reset_index().to_dict(orient="records")}

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
    return {"generators": df.reset_index().to_dict(orient="records")}

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
    return {"lines": df.reset_index().to_dict(orient="records")}

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
    return {"loads": df.reset_index().to_dict(orient="records")}

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
    return {"links": df.reset_index().to_dict(orient="records")}

@app.delete("/networks/{network_id}")
def delete_network(network_id: str):
    """Unload a network from memory."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    del networks[network_id]
    return {"deleted": network_id}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates."""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            # Echo back for now - will be used for optimization progress
            await websocket.send_json({"type": "ack", "received": msg})
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()
