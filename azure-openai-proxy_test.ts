import {
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { stub, returnsNext } from "https://deno.land/x/mock@0.15.2/mod.ts"; // Using a slightly more recent version of mock
import { handleRequest } from "./azure-openai-proxy.ts"; // This will also load config.ts

// --- Test Configuration ---
// Set up mock environment variables before config.ts is effectively loaded via azure-openai-proxy.ts
// These will be read by the `dotenv` and validated by `config.ts`
Deno.env.set("APIVERSION", "2024-02-01");
Deno.env.set("KEY1", "testkey1");
Deno.env.set("KEY2", "testkey2");
// We also need to ensure that the models in azure-openai-proxy.ts use these keys.
// The default models are:
// ["resourceName1", "gpt-4-turbo-2024-04-09", KEY1],
// ["resourceName1", "gpt-4o-2024-05-13", KEY1],
// ["resourceName2", "gpt-4-vision-preview", KEY2],
// ["resourceName2", "dall-e-3", KEY2]
// This setup is fine.

Deno.test("[Models Endpoint] /v1/models should return model list", async () => {
  const request = new Request("http://localhost/v1/models", { method: "GET" });
  const response = await handleRequest(request);
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("content-type"), "application/json");
  assertNotEquals(body.data.length, 0, "Model list should not be empty");
  
  const modelIds = body.data.map((m: any) => m.id);
  assertMatch(modelIds.join(","), /gpt-4-turbo-2024-04-09/);
  assertMatch(modelIds.join(","), /dall-e-3/);
  assertMatch(modelIds.join(","), /gpt-4o-2024-05-13/);
});

Deno.test("[Chat Completions] Successful proxy", async () => {
  const fetchStub = stub(globalThis, "fetch");
  const mockAzureResponse = { choices: [{ message: { content: "Hello!" } }] };

  fetchStub.resolves(
    new Response(JSON.stringify(mockAzureResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  const requestBody = {
    model: "gpt-4o-2024-05-13", // Uses KEY1
    messages: [{ role: "user", content: "Hi" }],
  };
  const request = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handleRequest(request);
  const responseBody = await response.json();

  assertEquals(response.status, 200);
  assertEquals(responseBody, mockAzureResponse);

  const fetchArgs = fetchStub.calls[0].args[0] as Request;
  const fetchCallBody = await fetchArgs.json();

  assertMatch(fetchArgs.url, /resourceName1\.openai\.azure\.com\/openai\/deployments\/gpt-4o-2024-05-13\/chat\/completions\?api-version=2024-02-01/);
  assertEquals(fetchArgs.method, "POST");
  assertEquals(fetchArgs.headers.get("api-key"), "testkey1");
  assertEquals(fetchCallBody.model, requestBody.model); // Model is part of the body sent to Azure
  assertEquals(fetchCallBody.messages, requestBody.messages);

  fetchStub.restore();
});

Deno.test("[Image Generations] Successful proxy", async () => {
  const fetchStub = stub(globalThis, "fetch");
  const mockAzureResponse = { data: [{ url: "http://example.com/image.png" }] };

  fetchStub.resolves(
    new Response(JSON.stringify(mockAzureResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  const requestBody = {
    model: "dall-e-3", // Uses KEY2
    prompt: "A drawing of a cat",
    n: 1,
    size: "1024x1024"
  };
  const request = new Request("http://localhost/v1/images/generations", {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handleRequest(request);
  const responseBody = await response.json();

  assertEquals(response.status, 200);
  assertEquals(responseBody, mockAzureResponse);
  
  const fetchArgs = fetchStub.calls[0].args[0] as Request;
  const fetchCallBody = await fetchArgs.json();

  assertMatch(fetchArgs.url, /resourceName2\.openai\.azure\.com\/openai\/deployments\/dall-e-3\/images\/generations\?api-version=2024-02-01/);
  assertEquals(fetchArgs.method, "POST");
  assertEquals(fetchArgs.headers.get("api-key"), "testkey2");
  assertEquals(fetchCallBody.prompt, requestBody.prompt);

  fetchStub.restore();
});


Deno.test("[Error Handling] Unsupported Model", async () => {
  const requestBody = { model: "unknown-model", messages: [] };
  const request = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handleRequest(request);
  const responseBodyText = await response.text();

  assertEquals(response.status, 400);
  assertEquals(responseBodyText, "Model not supported");
});

Deno.test("[Error Handling] Azure API Error (e.g., 401 Unauthorized)", async () => {
  const fetchStub = stub(globalThis, "fetch");
  const azureError = { error: { message: "Invalid API key" } };

  fetchStub.resolves(
    new Response(JSON.stringify(azureError), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  );

  const requestBody = { model: "gpt-4o-2024-05-13", messages: [] };
  const request = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handleRequest(request);
  const responseBody = await response.json();

  assertEquals(response.status, 401);
  assertEquals(responseBody, azureError);
  assertEquals(response.headers.get("content-type"), "application/json; charset=utf-8")

  fetchStub.restore();
});

Deno.test("[Error Handling] Network Error / Fetch Failure", async () => {
  const fetchStub = stub(globalThis, "fetch");
  fetchStub.rejects(new TypeError("Network request failed")); // Simulate network failure

  const requestBody = { model: "gpt-4o-2024-05-13", messages: [] };
  const request = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handleRequest(request);
  const responseBodyText = await response.text();
  
  // As per current implementation, TypeError results in 500
  assertEquals(response.status, 500); 
  assertMatch(responseBodyText, /Network or setup error when attempting to reach Azure: Network request failed/);

  fetchStub.restore();
});

Deno.test("[Error Handling] Invalid Path", async () => {
  const request = new Request("http://localhost/v1/unknown_path", { method: "GET" });
  const response = await handleRequest(request);
  const bodyText = await response.text();

  assertEquals(response.status, 404);
  assertEquals(bodyText, "404 Not Found");
});

// Additional test: Azure returns non-JSON error
Deno.test("[Error Handling] Azure API Error (Non-JSON response)", async () => {
  const fetchStub = stub(globalThis, "fetch");
  const azureErrorText = "Forbidden";

  fetchStub.resolves(
    new Response(azureErrorText, {
      status: 403, // Using 403 as an example
      headers: { "Content-Type": "text/plain" },
    }),
  );

  const requestBody = { model: "gpt-4o-2024-05-13", messages: [] };
  const request = new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(requestBody),
    headers: { "Content-Type": "application/json" },
  });

  const response = await handleRequest(request);
  const responseBodyText = await response.text();

  assertEquals(response.status, 403);
  assertEquals(responseBodyText, azureErrorText);
  assertEquals(response.headers.get("content-type"), "text/plain; charset=utf-8");


  fetchStub.restore();
});

// Test for OPTIONS request
Deno.test("[CORS] OPTIONS request should return 204 with CORS headers", async () => {
    const request = new Request("http://localhost/v1/chat/completions", { method: "OPTIONS" });
    const response = await handleRequest(request); // handleRequest should pass to handleOPTIONS

    assertEquals(response.status, 204);
    assertEquals(response.headers.get("access-control-allow-origin"), "*");
    assertEquals(response.headers.get("access-control-allow-methods"), "GET, POST, PUT, DELETE, OPTIONS");
    assertEquals(response.headers.get("access-control-allow-headers"), "*");
    assertEquals(response.headers.get("access-control-max-age"), "86400");
});
