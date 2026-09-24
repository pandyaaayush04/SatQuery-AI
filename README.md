# SatQuery AI

Ask questions about satellite imagery in plain language. A FastAPI backend runs the analysis and a fine-tuned Qwen3-VL model; a React app is the front end.

## Requirements

- Python 3.10+
- Node.js 20+
- NVIDIA GPU with 6 GB+ VRAM and CUDA (the model runs 4-bit quantized and is only needed for captioning, grounding, open questions and chat)
- Internet access (the base model downloads on first use, and place questions fetch live Sentinel-2 imagery)

## 1. Backend

From the project root:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn server.app:app --port 8000
```

The base model (`Qwen/Qwen3-VL-4B-Instruct`) downloads automatically on the first request that needs it.

### Model adapter

The fine-tuned adapter is not stored in this repository. Place the adapter folder (it contains `adapter_model.safetensors`) at:

```
kaggle_outputs/run1/adapter
```

or point to it with an environment variable (a local folder or a Hugging Face repo id):

```bash
# Windows PowerShell: $env:SATQUERY_ADAPTER = "path\to\adapter"
export SATQUERY_ADAPTER=path/to/adapter
```

## 2. Frontend

In a second terminal:

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to the backend on port 8000.

## 3. Optional: Google sign-in

Email and password accounts work with no setup. To also enable "Sign in with Google", create `server/.env` (see `server/.env.example`) with your OAuth client id and add `http://localhost:5173` under Authorized JavaScript origins for that client in Google Cloud Console.

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

## 4. Tests

```bash
python tests/test_auth.py
```
