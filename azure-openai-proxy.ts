import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { LogToFile } from "./logToFile.ts";
import { config } from "./config.ts";
const { APIVERSION, KEY1, KEY2 } = config;

const models = [
  ["resourceNaame1", "gpt-4-turbo-2024-04-09", KEY1],
  ["resourceNaame1", "gpt-4o-2024-05-13", KEY1],
  ["resourceNaame2", "gpt-4-vision-preview", KEY2],
  ["resourceNaame2", "dall-e-3", KEY2]
];

const apiVersion = APIVERSION;

const mapper: Record<string, number> = {
  'gpt-4-vision-preview': 2,
  'gpt-4-turbo-2024-04-09': 0,
  'gpt-4o-2024-05-13': 1,
  'dall-e-3': 3,
};

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathMap: Record<string, string> = {
    '/v1/chat/completions': 'chat/completions',
    '/v1/images/generations': 'images/generations',
    '/v1/completions': 'completions'
  };
  const path = pathMap[url.pathname];
  if (path) {
    return proxyRequest(request, path);
  } else if (url.pathname === '/v1/models') {
    return handleModels();
  } else {
    await LogToFile.log(`路径未找到: ${url.pathname}`, "Error", "./");
    return new Response('404 Not Found', { status: 404 });
  }
}

async function proxyRequest(request: Request, path: string): Promise<Response> {
  const body = await request.json();
  const modelName = body.model ?? "gpt-4-turbo-2024-04-09";
  if (!(modelName in mapper)) {
    await LogToFile.log(`模型不支持: ${modelName}`, "Error", "./");
    return new Response('Model not supported', {
      status:
        400
    });
  }

  const modelConfig = models[mapper[modelName]];
  const fetchAPI = `https://${modelConfig[0]}.openai.azure.com/openai/deployments/${modelConfig[1]}/${path}?api-version=${apiVersion}`;
  try {
    const response = await fetch(fetchAPI, {
      method: request.method,
      headers: { 
        "Content-Type": "application/json", 
        "api-key": modelConfig[2] 
      },
      body: typeof body === 'object' ? JSON.stringify(body) : '{}'
    });
    return new Response(response.body, {
      status: response.status,
      headers: new Headers({
        ...Object.fromEntries(response.headers),
        "Access-Control-Allow-Origin": "*"
      })
    });
  } catch (error) {
    await LogToFile.log(`代理请求失败: ${error}`, "Error", "./");
    return new Response("Internal Server Error", {
      status: 500
    });
  }
}

function handleModels(): Response {
  const data = {
    "object": "list",
    "data": Object.keys(mapper).map((key) => ({
      "id": key,
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai",
      "permission": [{
        "id": "modelperm-M56FXnG1AsIr3SXq8BYPvXJA",
        "object": "model_permission",
        "created": 1679602088,
        "allow_create_engine": false,
        "allow_sampling": true,
        "allow_logprobs": true,
        "allow_search_indices": false,
        "allow_view": true,
        "allow_fine_tuning": false,
        "organization": "*",
        group: null,
        is_blocking: false
      }],
      root: models[mapper[key]][1],  // 显示模型名称
      parent: null
    }))
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function handleOPTIONS(): Response {
  const respHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "*", "Access-Control-Max-Age": "86400" };
  LogToFile.log("处理OPTIONS请求", "Info", "./");
  return new Response(null, {
    status: 204, 
    headers: respHeaders
  });
}

serve((req) => req.method === 'OPTIONS' ? handleOPTIONS() : handleRequest(req), {
  port: 8080
});