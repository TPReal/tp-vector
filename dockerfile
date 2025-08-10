# Install the required tools:
# - node.js - https://nodejs.org/en
FROM node:current-slim
# - esbuild - https://esbuild.github.io/ (install globally)
RUN npm install -g esbuild
# - deno - https://deno.land/ (for type-checking)
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV PATH="$PATH:/root/.deno/bin"

# Create a directory for the code.
RUN mkdir /var/app
WORKDIR /var/app

# Start the Viewer.
CMD ["cmds/viewer"]
