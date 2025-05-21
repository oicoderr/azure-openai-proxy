import { config as loadConfig } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import { LogToFile } from "./logToFile.ts"; // Assuming logToFile.ts is in the same directory
// Deno.exit is a global, no specific import needed for it unless you want to alias it.

// Load configuration from .env file
const loadedConfig = loadConfig();

const essentialVarNames = ["APIVERSION", "KEY1", "KEY2"];
const missingOrEmptyVars: string[] = [];

for (const varName of essentialVarNames) {
  const varValue = loadedConfig[varName];
  // Check if the variable is missing, not a string, or an empty string
  if (varValue === undefined || varValue === null || typeof varValue !== 'string' || varValue.trim() === "") {
    missingOrEmptyVars.push(varName);
  }
}

if (missingOrEmptyVars.length > 0) {
  const errorMessage = `Essential environment variable(s) ${missingOrEmptyVars.join(", ")} are missing or empty. Application will exit.`;

  // Attempt to log to file.
  try {
    // If LogToFile.log is async and returns a Promise, it should be awaited.
    // However, if the program is about to exit, this log might not complete.
    // For critical exit messages, console.error is often more reliable.
    // Consider making LogToFile.log synchronous if possible for such cases,
    // or use it with the understanding it might not always complete before exit.
    LogToFile.log(errorMessage, "Error", "./");
  } catch (logError) {
    // Fallback if LogToFile.log itself throws an error
    console.error("Failed to write to log file during critical error:", logError);
  }

  // Ensure the error is printed to stderr for immediate visibility
  console.error(errorMessage);
  
  // Exit the process
  Deno.exit(1); // Use Deno.exit directly
}

export const config = loadedConfig;