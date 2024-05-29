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

    const filePath = fileName || import.meta.url;
    const logFilePath = await this.getCurrentLogFilePath();
    const timestamp = this.formatTimestamp();
    const logMessage = `${timestamp} [${type}] (${filePath}) - ${message}\n`;
    await Deno.writeTextFile(logFilePath, logMessage, { append: true });
  }
}

export { LogToFile };
