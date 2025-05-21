import { ensureDir } from "https://deno.land/std/fs/mod.ts";

class LogToFile {
  private static logDir = "./logs";
  private static currentLogFilePath: string | null = null;
  private static currentLogFileMaxSize = 5 * 1024 * 1024; // 5MB
  private static formatter = new Intl.DateTimeFormat("default", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });

  private static formatTimestamp(): string {
    const now = new Date();
    const formattedParts = this.formatter.formatToParts(now).reduce(
      (acc, part) => {
        if (part.type !== "literal") acc[part.type] = part.value;
        return acc;
      },
      {} as Record<string, string>,
    );
    return `${formattedParts.year}-${formattedParts.month}-${formattedParts.day} ${formattedParts.hour}:${formattedParts.minute}:${formattedParts.second}`;
  }

  private static async getLatestLogFile(): Promise<string | null> {
    await ensureDir(this.logDir);
    const entries = [];
    for await (const entry of Deno.readDir(this.logDir)) {
      if (entry.isFile) {
        entries.push(entry);
      }
    }
    entries.sort((a, b) => b.name.localeCompare(a.name));
    if (entries.length > 0) {
      return `${this.logDir}/${entries[0].name}`;
    }
    return null;
  }

  private static async getCurrentLogFilePath(): Promise<string> {
    const latestLogFile = await this.getLatestLogFile();
    if (latestLogFile) {
      try {
        const fileInfo = await Deno.stat(latestLogFile);
        if (fileInfo.size < this.currentLogFileMaxSize) {
          this.currentLogFilePath = latestLogFile;
          return latestLogFile;
        }
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
      }
    }
    const newFileName = `${this.logDir}/${this.formatTimestamp()}.log`;
    await Deno.create(newFileName);
    this.currentLogFilePath = newFileName;
    return newFileName;
  }

  static async log(
    message: string,
    type: "Error" | "Info" | "Warn" | "Debug" | "Fail",
    fileName?: string,
  ) {
    if (!message || !type) throw new Error("Message and type must be provided");

    let filePath: string;
    if (fileName) {
      filePath = fileName;
    } else {
      try {
        const err = new Error();
        const stack = err.stack;
        if (stack) {
          const lines = stack.split('\n');
          // Try to find the first line in the stack trace that is not part of LogToFile.ts
          // This usually means finding a line that doesn't contain "logToFile.ts"
          // Stack line examples:
          // "    at <functionName> (file:///path/to/file.ts:line:column)"
          // "    at file:///path/to/file.ts:line:column" (anonymous functions)
          // We need to find the caller of LogToFile.log(), so we look for the first entry
          // *not* in logToFile.ts itself.
          // Line 0 is "Error".
          // Line 1 is usually the current function (LogToFile.log).
          // Line 2 could be an internal helper if we created one.
          // Line 3 (or the first one not matching logToFile.ts path) should be the caller.

          let foundPath: string | null = null;
          for (let i = 1; i < lines.length; i++) { // Start from 1 to skip "Error" message
            const line = lines[i];
            if (!line.includes("logToFile.ts")) { // Heuristic: find first line not in this file
              // Try to extract path from common stack trace formats
              const match = line.match(/\((.*?):\d+:\d+\)$/) || line.match(/at (.*?):\d+:\d+$/);
              if (match && match[1]) {
                foundPath = match[1];
                // Remove "file://" prefix if present
                if (foundPath.startsWith("file://")) {
                  foundPath = foundPath.substring(7);
                }
                break; 
              }
            }
          }
          filePath = foundPath || "UnknownModule_StackTraceParseFail";
        } else {
          filePath = "UnknownModule_NoStack";
        }
      } catch (e) {
        filePath = "UnknownModule_ErrorDuringStackParse";
      }
    }

    const logFilePath = await this.getCurrentLogFilePath();
    const timestamp = this.formatTimestamp();
    const logMessage = `${timestamp} [${type}] (${filePath}) - ${message}\n`;
    await Deno.writeTextFile(logFilePath, logMessage, { append: true });
  }
}

export { LogToFile };
