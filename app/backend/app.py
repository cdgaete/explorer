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
import sys
import io
import os
import threading
import queue
import logging
import psutil
import multiprocessing
from multiprocessing import Process, Queue as MPQueue

# Store loaded networks in memory
networks: dict[str, pypsa.Network] = {}

# Store active WebSocket connections
active_connections: list[WebSocket] = []

# Store optimization status
optimization_status: dict[str, dict] = {}

# Store running optimization processes for cancellation
optimization_processes: dict[str, Process] = {}

# Queue for log messages from optimization
log_queue: queue.Queue = queue.Queue()

# Job queue for FIFO optimization scheduling
job_queue: list[dict] = []  # List of {id, network_id, solver, status, created_at, started_at, completed_at}
job_queue_lock = threading.Lock()
current_job_id: int = 0
job_processor_task = None


class LogCapture(io.StringIO):
    """Capture stdout and put lines into a queue."""
    def __init__(self, log_queue: queue.Queue, network_id: str):
        super().__init__()
        self.log_queue = log_queue
        self.network_id = network_id
        self.buffer_line = ""

    def write(self, text):
        self.buffer_line += text
        while "\n" in self.buffer_line:
            line, self.buffer_line = self.buffer_line.split("\n", 1)
            if line.strip():
                self.log_queue.put({"network_id": self.network_id, "log": line})
        return len(text)

    def flush(self):
        if self.buffer_line.strip():
            self.log_queue.put({"network_id": self.network_id, "log": self.buffer_line})
            self.buffer_line = ""


class QueueLoggingHandler(logging.Handler):
    """Logging handler that puts log messages into a queue."""
    def __init__(self, log_queue: queue.Queue, network_id: str):
        super().__init__()
        self.log_queue = log_queue
        self.network_id = network_id

    def emit(self, record):
        try:
            msg = self.format(record)
            # Split multiline messages
            for line in msg.split('\n'):
                if line.strip():
                    self.log_queue.put({"network_id": self.network_id, "log": line})
        except Exception:
            self.handleError(record)

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


def run_optimization_worker(network_path: str, network_id: str, solver: str, result_queue: MPQueue, log_queue: MPQueue):
    """Worker function that runs in a separate process for optimization."""
    try:
        # Load the network in this process
        n = pypsa.Network(network_path)

        # Set up logging handler to capture pypsa/linopy logs
        class QueueHandler(logging.Handler):
            def emit(self, record):
                try:
                    msg = self.format(record)
                    for line in msg.split('\n'):
                        if line.strip():
                            log_queue.put({"network_id": network_id, "log": line})
                except Exception:
                    pass

        log_handler = QueueHandler()
        log_handler.setFormatter(logging.Formatter('%(name)s: %(message)s'))
        log_handler.setLevel(logging.INFO)

        for logger_name in ['pypsa', 'linopy']:
            logger = logging.getLogger(logger_name)
            logger.setLevel(logging.INFO)
            logger.addHandler(log_handler)

        # Capture C-level stdout/stderr for HiGHS solver output using file descriptor redirection
        stdout_fd = sys.stdout.fileno()
        stderr_fd = sys.stderr.fileno()
        saved_stdout_fd = os.dup(stdout_fd)
        saved_stderr_fd = os.dup(stderr_fd)

        # Create pipes to capture output
        stdout_read_fd, stdout_write_fd = os.pipe()
        stderr_read_fd, stderr_write_fd = os.pipe()

        # Redirect stdout/stderr to write end of pipes
        os.dup2(stdout_write_fd, stdout_fd)
        os.dup2(stderr_write_fd, stderr_fd)

        # Thread to read from pipes and put into queue
        def pipe_reader(read_fd):
            with os.fdopen(read_fd, 'r', buffering=1) as f:
                for line in f:
                    line = line.rstrip('\n')
                    if line:
                        log_queue.put({"network_id": network_id, "log": line})

        stdout_thread = threading.Thread(target=pipe_reader, args=(stdout_read_fd,))
        stderr_thread = threading.Thread(target=pipe_reader, args=(stderr_read_fd,))
        stdout_thread.daemon = True
        stderr_thread.daemon = True
        stdout_thread.start()
        stderr_thread.start()

        try:
            status, termination = n.optimize(solver_name=solver)
            objective = float(n.objective) if hasattr(n, 'objective') and n.objective is not None else None

            # Save optimized network back to temp file so main process can reload it
            n.export_to_netcdf(network_path)

            result_queue.put({
                "success": True,
                "status": status,
                "termination": termination,
                "objective": objective,
            })
        finally:
            # Flush and restore file descriptors
            sys.stdout.flush()
            sys.stderr.flush()

            os.close(stdout_write_fd)
            os.close(stderr_write_fd)

            os.dup2(saved_stdout_fd, stdout_fd)
            os.dup2(saved_stderr_fd, stderr_fd)
            os.close(saved_stdout_fd)
            os.close(saved_stderr_fd)

            stdout_thread.join(timeout=1.0)
            stderr_thread.join(timeout=1.0)

            # Remove logging handlers
            for logger_name in ['pypsa', 'linopy']:
                logger = logging.getLogger(logger_name)
                logger.removeHandler(log_handler)

    except Exception as e:
        result_queue.put({
            "success": False,
            "error": str(e),
        })

def get_next_job_id():
    """Get the next job ID."""
    global current_job_id
    with job_queue_lock:
        current_job_id += 1
        return current_job_id


def add_job_to_queue(network_id: str, solver: str) -> dict:
    """Add a new job to the queue."""
    job = {
        "id": get_next_job_id(),
        "network_id": network_id,
        "solver": solver,
        "status": "queued",
        "created_at": datetime.now().isoformat(),
        "started_at": None,
        "completed_at": None,
        "error": None,
    }
    with job_queue_lock:
        job_queue.append(job)
    return job


def get_job_by_id(job_id: int) -> dict | None:
    """Get a job by ID."""
    with job_queue_lock:
        for job in job_queue:
            if job["id"] == job_id:
                return job.copy()
    return None


def get_running_job() -> dict | None:
    """Get the currently running job."""
    with job_queue_lock:
        for job in job_queue:
            if job["status"] == "running":
                return job.copy()
    return None


def get_queued_jobs() -> list[dict]:
    """Get all queued jobs."""
    with job_queue_lock:
        return [j.copy() for j in job_queue if j["status"] == "queued"]


async def broadcast_job_queue():
    """Broadcast the current job queue to all clients."""
    with job_queue_lock:
        queue_copy = [j.copy() for j in job_queue]
    await broadcast({
        "type": "job_queue",
        "jobs": queue_copy,
    })


async def run_optimization_job(job: dict):
    """Run a single optimization job."""
    network_id = job["network_id"]
    solver = job["solver"]
    job_id = job["id"]

    if network_id not in networks:
        with job_queue_lock:
            for j in job_queue:
                if j["id"] == job_id:
                    j["status"] = "failed"
                    j["error"] = f"Network '{network_id}' not found"
                    j["completed_at"] = datetime.now().isoformat()
        await broadcast_job_queue()
        return

    n = networks[network_id]

    # Update job status
    with job_queue_lock:
        for j in job_queue:
            if j["id"] == job_id:
                j["status"] = "running"
                j["started_at"] = datetime.now().isoformat()

    await broadcast_job_queue()

    # Initialize optimization status
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

    # Save network to temp file for the worker process
    temp_dir = tempfile.mkdtemp()
    network_path = os.path.join(temp_dir, f"{network_id}.nc")

    try:
        await broadcast({
            "type": "optimization_status",
            "network_id": network_id,
            "status": "running",
            "progress": 5,
            "message": "Preparing network for optimization...",
        })

        # Export network to temp file
        n.export_to_netcdf(network_path)

        await broadcast({
            "type": "optimization_status",
            "network_id": network_id,
            "status": "running",
            "progress": 10,
            "message": "Starting optimization process...",
        })

        # Create queues for inter-process communication
        result_queue = MPQueue()
        mp_log_queue = MPQueue()

        # Start optimization in separate process
        proc = Process(
            target=run_optimization_worker,
            args=(network_path, network_id, solver, result_queue, mp_log_queue)
        )
        proc.start()
        optimization_processes[network_id] = proc

        await broadcast({
            "type": "optimization_status",
            "network_id": network_id,
            "status": "running",
            "progress": 30,
            "message": "Solving optimization problem...",
        })

        # Monitor process and collect logs
        while proc.is_alive():
            # Process log messages
            while True:
                try:
                    msg = mp_log_queue.get_nowait()
                    if msg.get("network_id") == network_id:
                        await broadcast({
                            "type": "optimization_log",
                            "network_id": network_id,
                            "log": msg.get("log", ""),
                        })
                except:
                    break

            # Check if cancelled
            if network_id not in optimization_processes:
                # Was cancelled
                with job_queue_lock:
                    for j in job_queue:
                        if j["id"] == job_id:
                            j["status"] = "cancelled"
                            j["completed_at"] = datetime.now().isoformat()
                await broadcast_job_queue()
                return

            await asyncio.sleep(0.1)

        # Process remaining logs
        while True:
            try:
                msg = mp_log_queue.get_nowait()
                if msg.get("network_id") == network_id:
                    await broadcast({
                        "type": "optimization_log",
                        "network_id": network_id,
                        "log": msg.get("log", ""),
                    })
            except:
                break

        # Get result
        try:
            result = result_queue.get_nowait()
        except:
            result = {"success": False, "error": "No result from optimization process"}

        # Clean up process reference
        optimization_processes.pop(network_id, None)

        if result.get("success"):
            status = result.get("status")
            termination = result.get("termination")
            objective = result.get("objective")

            # Reload the optimized network to get results
            n_optimized = pypsa.Network(network_path)
            networks[network_id] = n_optimized

            await broadcast({
                "type": "optimization_status",
                "network_id": network_id,
                "status": "running",
                "progress": 90,
                "message": "Extracting results...",
            })

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

            # Update job status
            with job_queue_lock:
                for j in job_queue:
                    if j["id"] == job_id:
                        j["status"] = "completed"
                        j["completed_at"] = datetime.now().isoformat()

        else:
            error = result.get("error", "Unknown error")
            optimization_status[network_id] = {
                "running": False,
                "progress": 0,
                "status": "failed",
                "error": error,
            }

            await broadcast({
                "type": "optimization_status",
                "network_id": network_id,
                "status": "failed",
                "error": error,
            })

            # Update job status
            with job_queue_lock:
                for j in job_queue:
                    if j["id"] == job_id:
                        j["status"] = "failed"
                        j["error"] = error
                        j["completed_at"] = datetime.now().isoformat()

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

        # Update job status
        with job_queue_lock:
            for j in job_queue:
                if j["id"] == job_id:
                    j["status"] = "failed"
                    j["error"] = str(e)
                    j["completed_at"] = datetime.now().isoformat()

    finally:
        # Clean up temp directory
        try:
            shutil.rmtree(temp_dir)
        except:
            pass
        optimization_processes.pop(network_id, None)
        await broadcast_job_queue()


async def process_job_queue():
    """Background task that processes jobs one at a time."""
    while True:
        try:
            # Find next queued job
            next_job = None
            with job_queue_lock:
                for job in job_queue:
                    if job["status"] == "queued":
                        next_job = job
                        break

            if next_job:
                await run_optimization_job(next_job)
            else:
                await asyncio.sleep(0.5)

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Job Queue] Error: {e}")
            await asyncio.sleep(1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global job_processor_task
    print(f"[Backend] Starting with PyPSA {pypsa.__version__}")

    # Start the job processor
    job_processor_task = asyncio.create_task(process_job_queue())

    yield

    # Cancel job processor
    if job_processor_task:
        job_processor_task.cancel()
        try:
            await job_processor_task
        except asyncio.CancelledError:
            pass

    # Terminate any running processes
    for proc in optimization_processes.values():
        if proc.is_alive():
            proc.terminate()
            proc.join(timeout=1.0)

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
    """Queue an optimization job for a network."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")

    # Check if there's already a queued or running job for this network
    with job_queue_lock:
        for job in job_queue:
            if job["network_id"] == network_id and job["status"] in ["queued", "running"]:
                raise HTTPException(400, f"Optimization already queued or running for '{network_id}'")

    # Add job to queue
    job = add_job_to_queue(network_id, request.solver)

    # Broadcast updated queue
    await broadcast_job_queue()

    # Set initial status to queued
    optimization_status[network_id] = {
        "running": False,
        "progress": 0,
        "status": "queued",
        "queued_at": datetime.now().isoformat(),
    }

    await broadcast({
        "type": "optimization_status",
        "network_id": network_id,
        "status": "queued",
        "progress": 0,
        "message": "Job queued for optimization...",
    })

    return {
        "status": "queued",
        "job_id": job["id"],
        "position": len(get_queued_jobs()),
    }


@app.get("/jobs")
async def get_jobs():
    """Get all jobs in the queue."""
    with job_queue_lock:
        return {"jobs": [j.copy() for j in job_queue]}


@app.delete("/jobs/{job_id}")
async def cancel_job(job_id: int):
    """Cancel a queued job (remove from queue) or cancel running job."""
    # Find the job and determine action while holding lock
    job_found = False
    job_status = None
    network_id = None
    already_done = False

    with job_queue_lock:
        for job in job_queue:
            if job["id"] == job_id:
                job_found = True
                job_status = job["status"]
                network_id = job["network_id"]

                if job_status == "queued":
                    job["status"] = "cancelled"
                    job["completed_at"] = datetime.now().isoformat()
                elif job_status == "running":
                    job["status"] = "cancelled"
                    job["completed_at"] = datetime.now().isoformat()
                else:
                    already_done = True
                break

    if not job_found:
        raise HTTPException(404, f"Job {job_id} not found")

    if already_done:
        raise HTTPException(400, f"Job is already {job_status}")

    # Handle running job cancellation (outside the lock)
    if job_status == "running":
        proc = optimization_processes.pop(network_id, None)
        if proc and proc.is_alive():
            proc.terminate()
            proc.join(timeout=2.0)
            if proc.is_alive():
                proc.kill()
                proc.join(timeout=1.0)

        optimization_status[network_id] = {
            "running": False,
            "progress": 0,
            "status": "cancelled",
            "cancelled_at": datetime.now().isoformat(),
        }

        await broadcast({
            "type": "optimization_status",
            "network_id": network_id,
            "status": "cancelled",
            "progress": 0,
        })

    # Broadcast updated queue
    await broadcast_job_queue()
    return {"status": "cancelled"}


@app.get("/networks/{network_id}/optimization-status")
def get_optimization_status(network_id: str):
    """Get current optimization status."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    return optimization_status.get(network_id, {"status": "idle"})

@app.post("/networks/{network_id}/cancel-optimization")
async def cancel_optimization(network_id: str):
    """Cancel a running optimization by terminating the worker process."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")

    status = optimization_status.get(network_id, {})
    if not status.get("running"):
        raise HTTPException(400, "No optimization is running for this network")

    # Get and terminate the optimization process
    proc = optimization_processes.pop(network_id, None)
    if proc and proc.is_alive():
        proc.terminate()
        proc.join(timeout=2.0)  # Wait up to 2 seconds
        if proc.is_alive():
            proc.kill()  # Force kill if still alive
            proc.join(timeout=1.0)

    # Update status
    optimization_status[network_id] = {
        "running": False,
        "progress": 0,
        "status": "cancelled",
        "cancelled_at": datetime.now().isoformat(),
    }

    await broadcast({
        "type": "optimization_status",
        "network_id": network_id,
        "status": "cancelled",
        "progress": 0,
    })

    return {"status": "cancelled"}

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

# Full list of allowed statistics (from pypsa-app)
ALLOWED_STATISTICS = [
    "capex", "installed_capex", "expanded_capex", "opex", "system_cost",
    "revenue", "market_value", "installed_capacity", "expanded_capacity",
    "optimal_capacity", "supply", "withdrawal", "curtailment",
    "capacity_factor", "transmission", "energy_balance"
]
    
def serialize_statistics(data):
    """Convert pandas DataFrame/Series to JSON-serializable format."""
    import pandas as pd
    
    if isinstance(data, pd.DataFrame):
        result = data.to_dict(orient="split")
        # Convert tuple indices/columns to strings
        if result.get("index"):
            result["index"] = [str(idx) if isinstance(idx, tuple) else idx for idx in result["index"]]
        if result.get("columns"):
            result["columns"] = [str(col) if isinstance(col, tuple) else col for col in result["columns"]]
        # Clean NaN values
        result["data"] = [
            [None if (isinstance(v, float) and np.isnan(v)) else v for v in row]
            for row in result["data"]
        ]
        return result
    elif isinstance(data, pd.Series):
        return {str(k): (None if (isinstance(v, float) and np.isnan(v)) else v) 
                for k, v in data.to_dict().items()}
    else:
        return data

@app.post("/networks/{network_id}/statistics")
def get_statistics(network_id: str, request: StatisticsRequest):
    """Get network statistics using PyPSA's statistics module."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    
    if request.statistic not in ALLOWED_STATISTICS:
        raise HTTPException(400, f"Invalid statistic. Allowed: {ALLOWED_STATISTICS}")
    
    try:
        stat_func = getattr(n.statistics, request.statistic)
        result = stat_func(groupby=request.groupby)
        
        return {"data": serialize_statistics(result)}
    except Exception as e:
        raise HTTPException(500, f"Failed to compute statistics: {str(e)}")

@app.get("/networks/{network_id}/statistics/available")
def get_available_statistics(network_id: str):
    """List available statistics methods."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    return {"statistics": ALLOWED_STATISTICS}

@app.get("/networks/{network_id}/metadata")
def get_network_metadata(network_id: str):
    """Get detailed network metadata including carriers, countries, dimensions."""
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    
    # Extract carriers info
    carriers = {}
    for carrier_name in n.buses.carrier.unique():
        carrier_info = {}
        if carrier_name in n.carriers.index:
            carrier_data = n.carriers.loc[carrier_name].to_dict()
            # Filter out NaN/Inf values
            carrier_info = {
                k: v for k, v in carrier_data.items()
                if not (isinstance(v, float) and (np.isnan(v) or np.isinf(v)))
            }
        carriers[carrier_name] = carrier_info
    
    # Extract countries if available
    countries = []
    if "country" in n.buses.columns:
        countries = sorted(n.buses["country"].dropna().unique().tolist())
    
    # Dimensions
    dimensions = {
        "snapshots": len(n.snapshots),
        "investment_periods": len(n.investment_periods) if hasattr(n, 'investment_periods') else 1,
    }
    
    # Component counts
    components = {
        "buses": len(n.buses),
        "generators": len(n.generators),
        "lines": len(n.lines),
        "links": len(n.links),
        "loads": len(n.loads),
        "storage_units": len(n.storage_units),
        "stores": len(n.stores),
    }
    
    return {
        "id": network_id,
        "name": n.name or network_id,
        "carriers": carriers,
        "countries": countries,
        "dimensions": dimensions,
        "components": components,
    }

@app.get("/networks/{network_id}/topology.svg")
def get_topology_svg(network_id: str):
    """Generate simple SVG topology visualization."""
    from fastapi.responses import Response
    
    if network_id not in networks:
        raise HTTPException(404, f"Network '{network_id}' not found")
    n = networks[network_id]
    
    # Check if buses have coordinates
    if "x" not in n.buses.columns or "y" not in n.buses.columns:
        raise HTTPException(400, "Network buses don't have x/y coordinates")
    
    bus_pos = n.buses[["x", "y"]].dropna()
    if len(bus_pos) == 0:
        raise HTTPException(400, "No buses with valid coordinates")
    
    width, height, padding = 400, 300, 20
    
    # Calculate bounds
    min_x, max_x = bus_pos["x"].min(), bus_pos["x"].max()
    min_y, max_y = bus_pos["y"].min(), bus_pos["y"].max()
    x_range = max_x - min_x or 1
    y_range = max_y - min_y or 1
    
    def norm(x, y):
        nx = padding + (x - min_x) / x_range * (width - 2 * padding)
        ny = height - (padding + (y - min_y) / y_range * (height - 2 * padding))
        return nx, ny
    
    svg = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">',
        '<style>',
        '.line{stroke:#666;stroke-width:2;stroke-opacity:0.6}',
        '.link{stroke:#e74c3c;stroke-width:2;stroke-opacity:0.6;stroke-dasharray:4,2}',
        '.bus{fill:#3498db}',
        '</style>',
    ]
    
    # Draw lines
    for _, line in n.lines.iterrows():
        if line.bus0 in bus_pos.index and line.bus1 in bus_pos.index:
            x0, y0 = norm(bus_pos.loc[line.bus0, "x"], bus_pos.loc[line.bus0, "y"])
            x1, y1 = norm(bus_pos.loc[line.bus1, "x"], bus_pos.loc[line.bus1, "y"])
            svg.append(f'<line class="line" x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}"/>')
    
    # Draw links (dashed)
    for _, link in n.links.iterrows():
        if link.bus0 in bus_pos.index and link.bus1 in bus_pos.index:
            x0, y0 = norm(bus_pos.loc[link.bus0, "x"], bus_pos.loc[link.bus0, "y"])
            x1, y1 = norm(bus_pos.loc[link.bus1, "x"], bus_pos.loc[link.bus1, "y"])
            svg.append(f'<line class="link" x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}"/>')
    
    # Draw buses
    for idx, row in bus_pos.iterrows():
        x, y = norm(row["x"], row["y"])
        svg.append(f'<circle class="bus" cx="{x:.1f}" cy="{y:.1f}" r="4"/>')
    
    svg.append('</svg>')
    
    return Response(content="".join(svg), media_type="image/svg+xml")

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
