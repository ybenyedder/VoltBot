const chalk = require("chalk");
const moment = require("moment");
const fs = require("fs");
const path = require("path");

// --- File transport configuration -------------------------------------------
// One file per local day: logs/bot-YYYY-MM-DD.log under the instance cwd.
// Files older than FILE_RETENTION_DAYS are purged at startup then every 24h.
const FILE_RETENTION_DAYS = 7;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LOG_FILE_RE = /^bot-(\d{4}-\d{2}-\d{2})\.log$/;

class Logger {
  // --- Console timestamp (unchanged behavior) ---
  static get timestamp() {
    return moment().format("YYYY-MM-DD HH:mm:ss");
  }

  // --- File transport state ---
  static fileEnabled = true;
  static fileStream = null;
  static fileDate = null;
  static purgeTimerStarted = false;

  static get logDir() {
    const base = process.env.BOT_INSTANCE_CWD || process.cwd();
    return path.join(base, "logs");
  }

  // Local date (YYYY-MM-DD) used both for the file name and rotation check.
  static localDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Silently disable the file transport on any filesystem failure.
  static disableFileTransport() {
    this.fileEnabled = false;
    if (this.fileStream) {
      const stream = this.fileStream;
      this.fileStream = null;
      this.fileDate = null;
      try {
        stream.destroy();
      } catch {
        /* already closed */
      }
    }
  }

  // Lazily (re)open the stream for today's file; rotates at local midnight.
  static ensureFileStream() {
    if (!this.fileEnabled) return false;

    const today = this.localDateString();
    if (this.fileStream && this.fileDate === today) return true;

    try {
      fs.mkdirSync(this.logDir, { recursive: true });

      if (this.fileStream) {
        const previous = this.fileStream;
        this.fileStream = null;
        previous.end();
      }

      this.fileDate = today;
      this.fileStream = fs.createWriteStream(
        path.join(this.logDir, `bot-${today}.log`),
        { flags: "a" },
      );
      // Async write errors (disk full, deleted dir, ...) must never crash the bot.
      this.fileStream.on("error", () => this.disableFileTransport());

      this.purgeOldFiles();
      this.startPurgeTimer();
      return true;
    } catch {
      this.disableFileTransport();
      return false;
    }
  }

  // Remove bot-YYYY-MM-DD.log files older than the retention window.
  static purgeOldFiles() {
    if (!this.fileEnabled) return;
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      for (const file of files) {
        const match = LOG_FILE_RE.exec(file);
        if (!match) continue;
        try {
          const fileTime = new Date(
            `${match[1]}T00:00:00`,
          ).getTime();
          if (Number.isNaN(fileTime)) continue;
          if (now - fileTime > FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000) {
            fs.unlinkSync(path.join(this.logDir, file));
          }
        } catch {
          /* individual file purge failure is non-fatal */
        }
      }
    } catch {
      /* unreadable/missing dir: keep the transport enabled, retry next time */
    }
  }

  // Purge once at startup (first log), then once every 24h.
  static startPurgeTimer() {
    if (this.purgeTimerStarted) return;
    this.purgeTimerStarted = true;
    try {
      const timer = setInterval(() => this.purgeOldFiles(), PURGE_INTERVAL_MS);
      if (typeof timer.unref === "function") timer.unref();
    } catch {
      /* no timer: purge still happens on rotation */
    }
  }

  // Append one plain (uncolored) line: [ISO-timestamp] [LEVEL] message
  static writeToFile(level, content) {
    if (!this.ensureFileStream()) return;
    try {
      const message =
        typeof content === "string" ? content : String(content ?? "");
      this.fileStream.write(
        `[${new Date().toISOString()}] [${level}] ${message}\n`,
      );
    } catch {
      this.disableFileTransport();
    }
  }

  // --- Public API (console output unchanged; file output added) ---
  static success(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.green.bold("[SUCCESS]")} ${chalk.white(content)}`,
    );
    this.writeToFile("SUCCESS", content);
  }

  static info(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.cyan.bold("[INFO]")}  ${chalk.white(content)}`,
    );
    this.writeToFile("INFO", content);
  }

  static warn(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.yellow.bold("[WARN]")}  ${chalk.white(content)}`,
    );
    this.writeToFile("WARN", content);
  }

  static error(content, error = null) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.red.bold("[ERROR]")} ${chalk.white(content)}`,
    );
    if (error) {
      console.error(chalk.red(error.stack || error));
    }
    this.writeToFile("ERROR", content);
    if (error) {
      this.writeToFile("ERROR", error.stack || error);
    }
  }

  static debug(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.magenta.bold("[DEBUG]")} ${chalk.gray(content)}`,
    );
    this.writeToFile("DEBUG", content);
  }

  static cmd(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.blue.bold("[CMD]")}   ${chalk.white(content)}`,
    );
    this.writeToFile("CMD", content);
  }

  static event(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.hex("#FFA500").bold("[EVENT]")} ${chalk.white(content)}`,
    );
    this.writeToFile("EVENT", content);
  }

  static log(content, type = "log") {
    // type "log" (default) or unknown types fall back to info — calling
    // this["log"] directly would recurse infinitely.
    if (type !== "log" && this[type]) this[type](content);
    else this.info(content);
  }
}

module.exports = Logger;
