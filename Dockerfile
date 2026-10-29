# Toolchain image for the sandbox. Emscripten is preinstalled so the agent
# never needs the network to get a compiler.
FROM emscripten/emsdk:4.0.18@sha256:bbe90e2b00acbd1a9596087d88305029f383de1eb71c0cdb20f4e19647265450

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git make python3 nodejs npm \
 && rm -rf /var/lib/apt/lists/*

# Browser tooling is preinstalled so runtime checks need no package downloads.
# A fixed prefix makes CommonJS require('playwright') available through NODE_PATH.
# ESM scripts can import /opt/browser-tools/lib/node_modules/playwright/index.mjs.
ENV NODE_PATH=/opt/browser-tools/lib/node_modules \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
ENV PATH=/opt/browser-tools/bin:${PATH}
RUN npm install --global --prefix /opt/browser-tools playwright@1.56.1 \
 && playwright install --with-deps chromium \
 && chmod -R a+rX /opt/browser-tools /opt/ms-playwright

# Fail the image build if either compiler or browser startup is broken.
RUN emcc --version \
 && node -e "const { chromium } = require('playwright'); (async () => { const browser = await chromium.launch(); await browser.close(); })().catch(error => { console.error(error); process.exit(1); });"

WORKDIR /workspace
