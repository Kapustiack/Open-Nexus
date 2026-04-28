# OPEN NEXUS - SYSTEM REQUIREMENTS

To run Open Nexus in its elite autonomous state, your machine must meet the following software requirements:

### 1. CORE RUNTIMES
- **Node.js**: v18.0.0 or higher (Recommended: v20.x LTS)
- **Python**: v3.10 or higher (Required for machine-learning tasks and script execution)
- **Electron**: v41.3.0 (Bundled with npm install)

### 2. EXTERNAL AI ENGINES (Local Models)
Open Nexus is an orchestrator. You must have one of the following running locally:
- **Ollama**: [Download at ollama.com](https://ollama.com) (Running on http://localhost:11434)
- **LM Studio**: [Download at lmstudio.ai](https://lmstudio.ai) (Running on http://localhost:1234)

### 3. BUILD TOOLS (Windows)
- **Windows Build Tools**: Required for `node-pty` native compilation.
  - Install via CMD (Admin): `npm install --global windows-build-tools` or install Visual Studio Build Tools with "Desktop development with C++".

### 4. PYTHON DEPENDENCIES
While the core is light, the following libraries are recommended for full system orchestration:
- `pip install axios` (Used for certain agentic requests)
- `pip install psutil` (Recommended for advanced system monitoring)

### 5. HARDWARE RECOMMENDATIONS
- **RAM**: 16GB+ (Recommended for running local LLMs alongside the editor)
- **GPU**: NVIDIA RTX Series (Recommended for fast local model inference)
