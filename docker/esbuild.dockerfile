FROM node:latest

RUN mkdir /var/app
WORKDIR /var/app
RUN npm install -g esbuild
RUN curl -fsSL https://deno.land/x/install/install.sh | sh

ENTRYPOINT esbuild \
           src/viewer/viewer.ts \
           --watch=forever \
           --bundle \
           --format=esm \
           --sourcemap \
           --outdir=src/viewer/static \
           --serve=0.0.0.0:80 \
           --servedir=src/viewer/static \
           --charset=utf8 \
           --out-extension:.js=.mjs \
           --loader:.jpg=file \
           --loader:.png=file \
           --loader:.svg=file \
           --loader:.woff2=file
