#!/bin/bash
set -e

# Start ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for ollama to be ready (max 60 seconds).
# Uses the ollama CLI itself: the ollama/ollama image does not ship curl.
for i in {1..60}; do
  if ollama list > /dev/null 2>&1; then
    echo "Ollama is ready"
    break
  fi
  echo "Waiting for Ollama to be ready... ($i/60)"
  sleep 1
done

# Pull the model (same OLLAMA_MODEL the backend uses). A failed pull must not
# kill the server, but make the cause loud (e.g. "requires a newer version of
# Ollama" -> rebuild with `docker compose build --pull ollama`).
MODEL="${OLLAMA_MODEL:-gemma4:12b}"
echo "Pulling $MODEL model..."
if ollama pull "$MODEL"; then
  echo "Model ready. Ollama is running."
else
  echo "ERROR: failed to pull $MODEL (Ollama $(ollama --version 2>&1 | tail -1)). Extraction will fail until this is fixed."
fi

# Keep ollama running in the foreground
wait $OLLAMA_PID
