FROM denoland/deno:1.42.0

EXPOSE 8080

RUN mkdir -p /usr/src/azure-openai-proxy
WORKDIR /usr/src/azure-openai-proxy
COPY . .

USER root
RUN deno cache azure-openai-proxy.ts
CMD ["run", "--allow-read", "--allow-write", "--allow-net", "azure-openai-proxy.ts"]