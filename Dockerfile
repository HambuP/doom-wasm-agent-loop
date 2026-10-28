# Toolchain image for the sandbox. Emscripten is preinstalled so the agent
# never needs the network to get a compiler.
FROM emscripten/emsdk

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git make python3 nodejs npm \
 && rm -rf /var/lib/apt/lists/*

# Optional: a headless browser for checks that need a real page.
# Uncomment if your checks use one.
# RUN npm install -g playwright && npx playwright install --with-deps chromium

WORKDIR /workspace
