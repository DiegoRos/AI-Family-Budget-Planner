#!/bin/bash
set -e

# Start ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for ollama to be ready (max 60 seconds)
for i in {1..60}; do
  if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Ollama is ready"
    break
  fi
  echo "Waiting for Ollama to be ready... ($i/60)"
  sleep 1
done

# Pull the model (same OLLAMA_MODEL the backend uses)
MODEL="${OLLAMA_MODEL:-gemma4:12b}"
echo "Pulling $MODEL model..."
ollama pull "$MODEL"

echo "Model ready. Ollama is running."

# Keep ollama running in the foreground
wait $OLLAMA_PID
