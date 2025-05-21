import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { LogToFile } from "./logToFile.ts";
import { config } from "./config.ts";
const { APIVERSION, KEY1, KEY2 } = config;

const models = [
  ["resourceName1", "gpt-4-turbo-2024-04-09", KEY1],
  ["resourceName1", "gpt-4o-2024-05-13", KEY1],
  ["resourceName2", "gpt-4-vision-preview", KEY2],
  ["resourceName2", "dall-e-3", KEY2]
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

    if (!response.ok) {
      // Azure returned an HTTP error (4xx or 5xx)
      const azureStatus = response.status;
      let errorBodyToReturn: string | ReadableStream | null = null;
      let contentType = "text/plain; charset=utf-8";

      try {
        // Clone the response to be able to read its body and also potentially stream it
        const clonedAzureResponse = response.clone();
        const azureErrorBody = await clonedAzureResponse.json();
        // If parsing is successful, Azure's error is likely JSON
        errorBodyToReturn = JSON.stringify(azureErrorBody);
        contentType = "application/json; charset=utf-8";
        await LogToFile.log(`Azure API Error (${fetchAPI}) - Status: ${azureStatus}, Body: ${errorBodyToReturn}`, "Error");
      } catch (jsonParseError) {
        // Azure's error response was not valid JSON, or another error occurred
        // Try to get text body as fallback
        try {
            errorBodyToReturn = await response.text(); // Use original response as clone might be consumed or also failed
        } catch (textParseError) {
            errorBodyToReturn = "Azure returned an error, but its content could not be read.";
        }
        await LogToFile.log(`Azure API Error (${fetchAPI}) - Status: ${azureStatus}, Body: ${errorBodyToReturn} (Not JSON: ${jsonParseError.message})`, "Error");
      }

      return new Response(errorBodyToReturn, {
        status: azureStatus,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // If response.ok, proxy the successful response
    return new Response(response.body, {
      status: response.status,
      headers: new Headers({
        ...Object.fromEntries(response.headers), // Spread original headers
        "Access-Control-Allow-Origin": "*"      // Ensure CORS header
      })
    });

  } catch (error) {
    // This catch block handles network errors or other issues with the fetch call itself
    await LogToFile.log(`代理请求失败 (Network/Fetch Error for ${fetchAPI}): ${error.message || error.toString()}`, "Error");
    // Differentiate between TypeError (e.g. invalid URL, CORS issues not handled by server) and other errors
    let clientMessage = "Internal Server Error - Failed to connect to Azure OpenAI service.";
    let clientStatus = 502; // Bad Gateway

    if (error instanceof TypeError) {
        // TypeErrors are often client-side issues (e.g. malformed URL if not caught earlier, or network stack issues)
        // Or could be CSP, mixed content, or other browser-level security blocking the request.
        clientMessage = `Network or setup error when attempting to reach Azure: ${error.message}`;
        // For TypeError, 500 might be more appropriate than 502 if it's not strictly an upstream gateway issue
        clientStatus = 500; 
    }

    return new Response(clientMessage, {
      status: clientStatus,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
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

// Export for testing
export { handleRequest, proxyRequest, handleModels };