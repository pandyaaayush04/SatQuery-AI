# SatQuery AI: Ask Questions About Satellite Imagery

<div align="center">

![SatQuery AI](https://img.shields.io/badge/SatQuery%20AI-Physics--Verified%20Satellite%20Q%26A-0f3d3a?style=for-the-badge)
![Qwen3-VL](https://img.shields.io/badge/Model-Qwen3--VL--4B--Instruct-6a4c93?style=for-the-badge)
![QLoRA](https://img.shields.io/badge/Fine--tuned%20with-QLoRA-2e7d32?style=for-the-badge)
![SIH](https://img.shields.io/badge/Smart%20India%20Hackathon-2026-ff9933?style=for-the-badge)

**See Beyond. Ask Without Limits.**
*Earth speaks in images. You ask, we understand.*

</div>

---

## 🇮🇳 Smart India Hackathon 2026: Problem Statement

| | |
|---|---|
| **Problem Statement ID** | 26167 |
| **Problem Statement Title** | SatQuery AI - An Interactive Vision-Language Assistant for Multimodal Remote Sensing Image Analysis through Text Queries |
| **Organization** | Indian Space Research Organisation (ISRO) |
| **Department** | Department of Space / Indian Space Research Organisation |
| **Category** | Software |
| **Theme** | Space Technology |

### Description

**Background**
Remote-sensing imagery is widely used for agricultural monitoring, disaster management, urban planning, forest monitoring, water-resource assessment, infrastructure mapping, and environmental analysis. However, most existing remote-sensing AI solutions are developed as isolated applications for a single predefined task, such as land-cover classification, object detection, visual question answering, or change detection. These systems often require users to understand satellite-data characteristics, GIS workflows, model selection, and task-specific parameters. Consequently, non-expert users may find it difficult to obtain meaningful information from satellite imagery through simple natural-language queries.

Many operational remote-sensing questions cannot always be answered reliably using a single optical image. Relevant information may be distributed across paired or multiple observations acquired at different times or by different sensors. Optical and multispectral imagery provides spectral and contextual information, whereas synthetic aperture radar (SAR) provides complementary structural information and supports day-and-night acquisition through cloud cover. Multitemporal image pairs are required to identify and interpret changes over time, while co-registered optical–SAR pairs can provide more complete and reliable information than either modality alone.

A general-purpose large language model (LLM) or vision-language model (VLM) cannot be expected to perform these specialised tasks reliably without adaptation to remote-sensing imagery, sensor characteristics, and domain-specific terminology. The proposed solution must therefore include remote-sensing fine-tuning or domain adaptation and may employ multiple specialised models for different tasks. BigEarthNet.txt will serve as the primary dataset for adapting image–text representations to multisensor remote-sensing data. VRSBench and RSVQA will be used to evaluate single-image captioning, grounding, and visual question answering, while CDVQA will be used to evaluate multitemporal change-based visual question answering.

The novelty of SatQuery AI lies in its agentic, query-driven framework. Instead of applying a single generic VLM, the system selects and executes suitable remote-sensing specialist models, validates inputs, combines their outputs, and returns an evidence-grounded response.

**Description**
The objective is to develop SatQuery AI, a software-based agentic vision-language assistant for analysing single and paired remote-sensing images through natural-language queries. Single-image understanding is a mandatory baseline, while the principal focus is joint reasoning over paired cross-modal and multitemporal imagery.

**Defined Input Scope**

- **Single image:** One optical/multispectral or SAR image for captioning, visual question answering, and text-guided region grounding.
- **Cross-modal pair:** Co-registered optical/multispectral and SAR images of the same geographic area for joint information extraction and cross-modal analysis.
- **Bi-temporal pair:** Two spatially corresponding images of the same geographic area acquired at different times for change detection, change description, and change-based visual question answering.
- **Supported formats:** GeoTIFF or TIFF for geospatial imagery. PNG and JPEG inputs may be accepted only for the prescribed public benchmark datasets.

**Mandatory Functional Scope**

- **Remote-sensing adaptation:** At least one visual or vision-language component must be fine-tuned or otherwise adapted using BigEarthNet.txt or the any open source training data.
- **Single-image baseline:** Visual question answering shall be mandatory. Each solution must additionally implement either captioning/scene description or text-guided region grounding.
- **Multi-image change analysis:** Change description or change-based visual question answering from a bi-temporal image pair shall be mandatory. A spatial change map may also be generated where reference masks are available.
- **Cross-modal pair analysis:** The system must extract complementary information from a co-registered optical/multispectral and SAR image pair.
- **Agentic orchestration:** The system must automatically select, sequence, and execute the appropriate specialist models or tools according to the query and input configuration.

**Representative Queries**

- 'Describe the land-cover and major objects visible in this image.'
- 'Highlight the water body referred to in the query.'
- 'What changed between these two dates, and where did the change occur?'
- 'Use the optical and SAR images together to identify built-up and water-covered regions.'
- 'Has the built-up area increased, decreased, or remained unchanged?'

**Agentic Model and Tool Orchestration**
The system may use multiple specialised components, such as a remote-sensing VQA or captioning model, a grounding model, a change-understanding or change-VQA model, and an optical–SAR fusion or information-extraction model.

- interpret the query and classify the requested task;
- check the number, modality, format, metadata, and compatibility of the input images;
- select one or more models or tools from a predefined registry;
- configure only permitted task parameters and execute the selected workflow;
- combine textual and spatial outputs, estimate confidence, and return visual evidence; and
- provide an auditable execution summary containing the selected task, model/tool names, and key parameters.

The controller may perform internal task planning; however, only the observable execution trace, including the selected task, models or tools, permitted parameters, and outputs will be evaluated. Internal reasoning text is neither required nor evaluated.

**Expected Solution**
The expected solution is an interactive GUI or web application with an agentic remote-sensing AI backend. It should accept supported image inputs and natural-language queries, select the appropriate specialist workflow, and return evidence-grounded textual and visual results.

The solution should include:

- Input upload and compatibility checking.
- A remote-sensing-adapted vision-language component.
- Specialist tools for VQA, captioning or grounding, change understanding, and optical–SAR analysis.
- An agentic controller for task routing, tool execution, and output integration.
- Visual evidence, confidence information, execution summaries, and downloadable reports.

Each solution must demonstrate single-image VQA, one additional single-image task, multitemporal change understanding, optical–SAR paired-image analysis, and agentic model/tool orchestration. A generic LLM or VLM without remote-sensing adaptation will not satisfy the requirements.

**Deliverables**
An interactive GUI or web application with an agentic remote-sensing AI backend, Codes and models including test and demonstration.

**Implementation Scope**
The system shall support single optical/multispectral or SAR images, co-registered optical–SAR pairs, and bi-temporal pairs in GeoTIFF/TIFF or approved benchmark formats. It must perform single-image VQA, one additional single-image task, change analysis, optical–SAR joint analysis, and agentic model/tool selection through an interactive GUI or web application.

**Evaluation/Judging Criteria**
Final evaluation will use prescribed public benchmark test subsets and an ISRO/SAC evaluation dataset. Scores will be normalised before combining different metrics.

Public benchmarks will be evaluated using the prescribed test splits. The ISRO/SAC evaluation set will contain pre-georeferenced and co-registered Cartosat-2S optical and RISAT SAR image pairs, with task-specific reference answers, labels, bounding boxes, or masks, as applicable. Evaluation annotations will not be disclosed to participating teams.

---

## 🖥️ Platform Preview

<img src="docs/screenshots/Platform%20Preview.png" alt="SatQuery AI: Project Overview" width="100%"/>

> *The SatQuery AI landing page: a live 3D Earth with real satellite orbits, and a chat box that answers questions about satellite imagery.*

---

## Our Submission

| Field | Details |
|---|---|
| **Project** | **SatQuery AI**: See Beyond. Ask Without Limits. |
| **Vision-Language Model** | **Qwen3-VL-4B-Instruct** (`Qwen/Qwen3-VL-4B-Instruct`), 4-bit quantized |
| **Remote-sensing adaptation** | **QLoRA** adapter trained on **BigEarthNet.txt** (Sentinel-1 radar and Sentinel-2 optical) |
| **Verification Layer** | Physics band-index engine (NDWI · NDVI · NDBI · SAR backscatter) and a noise-robust change-detection engine |
| **Team** | Tanisha Sharma (Team Leader) · Harsh Parekh · Riya Prajapati · Mahi Parmar · Aayush Pandya · Khushi Bhanushali |

---

## The Problem We Are Solving

Satellites capture the whole planet every few days, but getting an answer out of that imagery is slow and needs specialists:

- Reading a satellite scene takes **trained GIS and remote-sensing experts**, so questions from planners, responders and administrators wait in a queue.
- General AI chatbots can *describe* an image, but they often answer **confidently even when the image does not support the claim**. That is unsafe for disaster response, land monitoring or defence.
- Real users often have **only one sensor**: optical is blocked by cloud or night, and radar (SAR) is hard for non-experts to read.
- Most tools give a sentence and **no evidence**, so a reviewer cannot check how the answer was reached.

> **Result:** Valuable Earth-observation data goes unused because asking a simple question of it is too slow, too technical, and too hard to trust.

---

## Solution Description

**SatQuery AI** lets anyone ask a plain-language question about a satellite image (one scene, an optical + radar pair, or a before/after pair) and get an answer that is **checked against the sensor data itself**, comes with a **confidence level**, and says *"I can't verify this"* when the evidence is not enough.

```
Image(s) + question -> Preflight validation -> Task routing
        -> Physics engine / Change engine / Vision-language model
        -> Cross-check + confidence -> Answer with a plain-language trace
```

Everything lives in one chat interface:

- **Single image:** what is in it, where things are, how much water or greenery
- **Optical + SAR fusion:** combine a normal image and a radar image of the same place
- **Before / after change:** what changed between two dates, and where
- **Name a place:** type "land cover around Pune" and live Sentinel-2 imagery is fetched for you

---

### How SatQuery AI Meets the Problem Statement

| Requirement (from the problem statement) | Status | How |
|---|---|---|
| Remote-sensing adaptation using BigEarthNet.txt | ✅ Done | Qwen3-VL-4B-Instruct fine-tuned with QLoRA on a BigEarthNet.txt subset |
| Single-image visual question answering | ✅ Done | Physics-verified presence questions plus the fine-tuned model for open questions |
| One more single-image task (captioning or grounding) | ✅ Done | The adapter is trained for both captioning and bounding-box grounding |
| Change description / change-based VQA from a bi-temporal pair | ✅ Done | Change engine reports changed area, largest regions, direction and land-cover trends |
| Spatial change map | ✅ Done | Change mask drawn over the image |
| Cross-modal (optical + SAR) analysis | ✅ Done | Both sensors are checked and combined into one answer |
| Input upload and compatibility checking | ✅ Done | Preflight checks georeferencing, sensor type, overlap, resolution and time order |
| Agentic task routing and tool orchestration | ✅ Done | Router picks the workflow; tools run in sequence; results are integrated |
| Visual evidence, confidence, execution summary | ✅ Done | Previews, change map, boxes, confidence level and a plain-language trace |
| Downloadable reports | ⏳ Not yet | Planned |
| Evaluation on VRSBench, RSVQA and CDVQA | ⏳ Not yet | Our benchmark so far is a held-out BigEarthNet.txt split (see Models Used) |

---

## AI Approach & Architecture

### System Architecture

```
+------------------------------------------------------------------+
|                    FRONTEND (React 19 + Vite)                    |
|  Landing Page (3D globe) -> Chat Studio -> Auth / Saved Chats    |
|  Image Previews | Change Map Overlay | Copy / Edit / Share       |
+------------------------------+-----------------------------------+
                               | HTTP / REST
+------------------------------v-----------------------------------+
|                       BACKEND (FastAPI)                          |
|                                                                  |
|  +--------------+  +---------------+  +------------------------+ |
|  | Preflight    |  | Task Router   |  | Auth + Saved Chats     | |
|  | georef, GSD, |  | change/fusion |  | scrypt, email codes,   | |
|  | overlap,time |  | vqa/caption/  |  | Google sign-in, SQLite | |
|  +------+-------+  | grounding     |  +------------------------+ |
|         |          +-------+-------+                             |
|  +------v-------+  +-------v-------+  +------------------------+ |
|  | Physics      |  | Change        |  | Qwen3-VL-4B + QLoRA    | |
|  | NDWI/NDVI/   |  | Detection     |  | caption / VQA /        | |
|  | NDBI / SAR   |  | MAD threshold |  | grounding / chat       | |
|  +------+-------+  +-------+-------+  +-----------+------------+ |
|         +-----------+------+----------------------+              |
|              Cross-check -> Confidence -> Audit trace            |
+------------------------------+-----------------------------------+
                               |
+------------------------------v-----------------------------------+
|                    EXTERNAL DATA SERVICES                        |
|  Microsoft Planetary Computer (Sentinel-2)  |  OpenStreetMap     |
|  Wikipedia summaries                        |  CelesTrak TLEs    |
+------------------------------------------------------------------+
```

### AI Pipeline: Step by Step

| Step | Technology | What Happens |
|---|---|---|
| 1. Ingest | GeoTIFF upload / live place fetch | Upload 1-2 GeoTIFFs, or name a place and fetch fresh Sentinel-2 imagery |
| 2. Preflight | `rasterio` | Checks real georeferencing, sensor type, footprint overlap, resolution and acquisition time |
| 3. Route | Rule-based router | Classifies the question: change, fusion, open question, caption or grounding |
| 4. Verify | **Physics engine** | Water, vegetation and built-up questions are answered from NDWI / NDVI / NDBI and SAR thresholds |
| 5. Compare | **Change engine** | Per-pixel change with a noise-robust threshold; regions, size, direction and land-cover trends |
| 6. Understand | **Qwen3-VL-4B + QLoRA** | Captions, open questions and bounding boxes; its answer is cross-checked against the physics result |
| 7. Score | Confidence rules | Agreement is high, disagreement is low, model-only is moderate, no evidence means abstain |
| 8. Explain | Audit trace | The answer arrives with the steps taken, in plain language |

---

## 🧠 Models Used

SatQuery AI uses **one fine-tuned vision-language model** and **two deterministic science engines**. The model handles what only a model can (description, open questions, locating things). The engines answer the factual questions from the sensor signal itself.

### 1. Qwen3-VL-4B-Instruct: Vision-Language Model

| | |
|---|---|
| **Model** | `Qwen/Qwen3-VL-4B-Instruct` |
| **Role** | Captioning, open visual Q&A, bounding-box grounding, and open chat |
| **Precision** | 4-bit NF4 quantization (`bitsandbytes`), fits on a 6 GB laptop GPU |
| **Loaded** | Lazily in a background thread, so the app answers sensor-only questions while it warms up |

```python
# How the model is loaded in SatQuery AI (satquery/vlm.py)
model = AutoModelForImageTextToText.from_pretrained(
    "Qwen/Qwen3-VL-4B-Instruct",
    dtype=torch.float16,
    device_map={"": 0},
    quantization_config=BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        llm_int8_skip_modules=["visual", "lm_head"],
    ),
)
model = PeftModel.from_pretrained(model, adapter_path)  # the QLoRA adapter
```

### 2. SatQuery QLoRA Adapter: Fine-tuned for Earth Observation

The base model is fine-tuned with **QLoRA** (a small trained adapter on the frozen 4-bit model) so it answers in the exact formats each task needs: one word for yes/no, a letter for multiple choice, a normalised box for grounding, and a fluent sentence for captions.

| | |
|---|---|
| **Method** | QLoRA (LoRA adapter on a 4-bit base) |
| **Training data** | **BigEarthNet.txt**: BigEarthNet v2 Sentinel-1 (radar) and Sentinel-2 (optical) patches with a question-answer layer |
| **Tasks** | Captioning · yes/no · multiple choice · bounding-box grounding |
| **Coverage** | 10 countries · 4 seasons · 10 climate zones |
| **Modality robustness** | One sensor is randomly withheld during training, so it answers from optical only, radar only, or both |
| **Training compute** | Free Kaggle GPUs |

**Held-out benchmark results (200 questions per task type):**

| Task | Base model | With our adapter |
|---|---|---|
| Yes / no (accuracy) | 0.47 | **0.71** |
| Multiple choice (accuracy) | 0.01 | **0.63** |
| Bounding box (mean IoU) | 0.04 | **0.47** |
| Bounding box (accuracy at IoU 0.5) | 0.01 | **0.56** |
| Captioning (ROUGE-L) | 0.13 | **0.54** |

### 3. Physics Engine: Deterministic, No Model

| Concept | Signal |
|---|---|
| Water | **NDWI** from optical bands, and low radar backscatter |
| Vegetation | **NDVI** from red and near-infrared |
| Built-up area | **NDBI** from shortwave and near-infrared, and high radar backscatter |

Presence and absence questions are answered directly from these indices. When the model also answers, the two are compared: agreement keeps high confidence, disagreement is shown and lowers it.

### 4. Change-Detection Engine: Deterministic, No Model

Builds a per-pixel change signal from whichever sensor is present in both dates, thresholds it with a noise-robust statistic (median absolute deviation) so pure noise cannot register as change, then reports the largest changed regions with their size and direction, plus whether water, vegetation and built-up area went up or down.

---

## Features

| Feature | Description |
|---|---|
| Ask in plain language | Single image, optical + SAR fusion, or before/after questions |
| Physics-verified answers | Water, vegetation and built-up answers come from the sensor signal |
| Honest abstention | Says so, politely, when the evidence is not enough |
| Confidence in plain words | "Confident", "Fairly sure", "Not very sure" |
| Plain-language explanation | "How I worked this out" instead of raw technical output |
| Name a place | Live Sentinel-2 imagery from Microsoft Planetary Computer |
| Asks when unsure | "Which lake do you mean?" for a vague place |
| Image previews | Previews in the text box and in the chat; click to enlarge |
| Change map | Changed areas drawn on the image |
| Edit with versions | Edit a question and flip between versions with their answers |
| Copy · Edit · Share | On questions and answers |
| Saved chats | Named from your questions, newest on top, synced to your account |
| Accounts | Email + password with email verification and forgot-password, or Google sign-in |
| Live 3D globe | Real satellite orbits (Sentinel, Landsat, Aqua, Cartosat, ISS) |
| Works everywhere | Phone, tablet, small laptop and desktop |

---

## 💬 Chat Capabilities & Category Showcase

The chat has a category picker (Auto-detect · Single image · Optical + SAR fusion · Before / after change). Here is each showcase answering a real satellite query.

### 1. Single Image

<img src="docs/screenshots/Single%20Image.png" alt="Single Image Chat Response" width="100%"/>

> *A Sentinel-2 image of Palm Jumeirah, Dubai.* **Question:** "Is there water in this scene?" **Answer:** Yes, with high confidence, checked against the water index.

### 2. Optical + SAR Fusion

<img src="docs/screenshots/Optical%20SAR%20Fusion.png" alt="Optical and SAR Fusion Chat Response" width="100%"/>

> *An optical image and a radar image of the Ganga-Yamuna confluence at Prayagraj, taken two days apart.* **Question:** "Is there water in this scene?" **Answer:** "Water is present based on combined optical+SAR evidence."

### 3. Before / After Change

<img src="docs/screenshots/Before%20After.png" alt="Before and After Change Chat Response" width="100%"/>

> *Derna, Libya, before (28 Aug 2023) and after (1 Dec 2023) the September flood.* **Question:** "What changed between these two dates?" **Answer:** the share of the scene that changed, where the largest change is, and how built-up area went down, with a change map drawn on the image.

### 4. Text Query & Live Location Analysis

<img src="docs/screenshots/No%20Image.png" alt="Text Query Live Location Fetch Response" width="100%"/>

> *Ask a plain-language question or query a location directly (e.g., "How has Navi Mumbai changed since last year?") without uploading files. SatQuery AI fetches live Sentinel-2 imagery from Microsoft Planetary Computer and returns physics-backed analysis.*

---

## 🛠️ Development Environment

<img src="docs/screenshots/Development%20Environment.png" alt="Development Environment: VS Code" width="100%"/>

> *SatQuery AI is built and run from VS Code: a FastAPI backend, a React + Vite frontend, and the fine-tuned model running locally on a 6 GB GPU.*

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | **FastAPI** + Uvicorn |
| Vision-language model | **Qwen3-VL-4B-Instruct** via Hugging Face Transformers |
| Fine-tuning | **PEFT (LoRA)** + **bitsandbytes** 4-bit (QLoRA) |
| Deep learning | PyTorch |
| Geospatial | **rasterio**, NumPy, SciPy, scikit-image |
| Accounts | scrypt password hashing, signed HttpOnly session cookies, SQLite |
| Email | SMTP verification and reset codes |
| Data services | Microsoft Planetary Computer (Sentinel-2), OpenStreetMap Nominatim, Wikipedia |

### Frontend
| Layer | Technology |
|---|---|
| Framework | **React 19** + Vite |
| Language | TypeScript |
| Styling | **Tailwind CSS v4** + tw-animate-css |
| UI Components | shadcn/ui + Radix UI |
| 3D Globe | react-globe.gl + three.js |
| Satellite orbits | satellite.js (SGP4) with CelesTrak orbital elements |
| Icons | Phosphor Icons |
| Sign-in | Google Identity Services |

---

## Project Structure

```
SatQuery-AI/
+-- server/                           # FastAPI Python backend & REST API endpoints
|   +-- app.py                        # App factory, CORS, routes & session registry
|   +-- auth.py                       # User auth, scrypt hashing, cookies & SQLite DB
|   +-- config.py                     # Environment variables & runtime settings
|   +-- .env.example                  # Template configuration file
|
+-- satquery/                         # Agentic Remote-Sensing & VLM core engine
|   +-- vlm.py                        # Qwen3-VL-4B lazy model loader & QLoRA inference
|   +-- router.py                     # Rule-based task classifier & workflow router
|   +-- physics.py                    # Deterministic spectral indices (NDWI, NDVI, NDBI)
|   +-- change.py                     # Noise-robust bi-temporal MAD change detection
|   +-- preflight.py                  # Rasterio geospatial metadata & compatibility checks
|   +-- sentinel.py                   # Microsoft Planetary Computer live imagery fetcher
|
+-- web/                              # React 19 + Vite frontend
|   +-- src/
|   |   +-- App.tsx                   # Main layout & route router
|   |   +-- components/               # UI components (3D Globe, Chat, Studio, Auth)
|   |   +-- lib/                      # API client, types & state management
|   +-- index.html
|   +-- package.json
|
+-- docs/                             # Documentation & proof of work
|   +-- screenshots/                  # High-res application screenshots
|   +-- proposed-solution.md          # Technical solution design & architecture
|   +-- dataset-description.md        # BigEarthNet.txt & benchmark dataset specs
|   +-- demo-guide.md                 # Interactive evaluation walkthrough guide
|   +-- ppt-content.md                # Hackathon presentation content
|
+-- kaggle_outputs/                   # Fine-tuned QLoRA adapter artifacts
+-- README.md                         # Project documentation
+-- requirements.txt                  # Python dependencies
```

---

## Quick Start

### Prerequisites
- Python 3.10+ · Node.js 20+
- NVIDIA GPU with 6 GB+ VRAM and CUDA (only needed for the language-model answers)
- Internet access (the base model downloads on first use, and place questions fetch live imagery)

### 1. Clone
```bash
git clone https://github.com/pandyaaayush04/SatQuery-AI.git
cd SatQuery-AI
```

### 2. Backend
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate      macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn server.app:app --port 8000
```

The base model `Qwen/Qwen3-VL-4B-Instruct` (about 9 GB) downloads automatically the first time a question needs it.

### 3. Model adapter
The trained adapter is not stored in this repository. Put the adapter folder (it contains `adapter_model.safetensors`) at `kaggle_outputs/run1/adapter`, or point to it:
```bash
# Windows PowerShell: $env:SATQUERY_ADAPTER = "path\to\adapter"
export SATQUERY_ADAPTER=path/to/adapter
```

### 4. Frontend
```bash
cd web
npm install
npm run dev          # development, http://localhost:5173
npm run build        # production build, then the backend serves it at http://localhost:8000
```

### 5. Open
```
http://localhost:5173      (development)
http://localhost:8000      (after npm run build)
```

---

## Environment Variables

### `server/.env` (copy from `server/.env.example`)
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com   # optional: enables "Sign in with Google"

SMTP_HOST=smtp.gmail.com          # optional: sends verification and password-reset codes by email
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=you@example.com

SATQUERY_SHOW_CODES=              # 1 = show codes on screen when SMTP is not set up (demo only)
SATQUERY_ADAPTER=                 # optional: path or Hugging Face id of the adapter
```
With no SMTP settings, codes are printed in the backend terminal. The frontend needs no environment variables.

---

## API Reference

### Chat and Analysis
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | One message in: small talk, a named place, a question about the attached imagery, or plain chat |
| `POST` | `/api/session` | Upload 1-2 GeoTIFFs and validate them (with the chosen category) |
| `POST` | `/api/ask` | Ask a question about the current session |
| `POST` | `/api/thumb` | Small preview image of a GeoTIFF |
| `GET` | `/api/preview/{session_id}/{index}` | Rendered preview of an uploaded image |
| `GET` | `/api/overlay/{session_id}` | Change map for a before/after pair |
| `GET` | `/api/status` | Whether the model is loaded |
| `DELETE` | `/api/session/{session_id}` | Discard a session |

### Accounts and Saved Chats
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create an account and email a 6-digit code |
| `POST` | `/api/auth/verify` | Confirm the code and sign in |
| `POST` | `/api/auth/resend` | Send a new verification code |
| `POST` | `/api/auth/login` | Log in with email and password |
| `POST` | `/api/auth/forgot` | Email a password-reset code |
| `POST` | `/api/auth/reset` | Set a new password with the code |
| `POST` | `/api/auth/google` | Sign in with a Google ID token |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/me` | Current user |
| `GET` `PUT` `DELETE` | `/api/chats` · `/api/chats/{id}` | Saved chat history |

---

## Security

- Passwords are hashed with **scrypt** and a per-user salt, never stored in plain text
- New accounts must **verify their email** with a 6-digit code (expires in 10 minutes, burnt after 5 wrong tries)
- Login, registration, verification and reset are **rate-limited**; error messages never reveal which emails have accounts
- Password rules: 8-128 characters, a letter and a number, not a common password
- Sessions are **signed HttpOnly cookies**
- No secrets are committed: `.env` files, the database and the cookie-signing key are git-ignored

---

## User Journey

```
http://localhost:5173  (Landing: live 3D Earth)
        |
"Try Now" / Log in / Register
        |
Chat Studio: pick a category · attach image(s) or name a place · ask
        |
Answer with confidence + "How I worked this out" + previews / change map
        |
Copy · Edit (versions) · Share · Saved in Recents
```

---

<div align="center">

**Built for the Smart India Hackathon 2026 · Problem Statement 26167 · ISRO**

*SatQuery AI: Earth speaks in images. You ask, we understand.*

</div>
