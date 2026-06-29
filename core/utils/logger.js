const chalk = require("chalk");
const moment = require("moment");

class Logger {
  static get timestamp() {
    return moment().format("YYYY-MM-DD HH:mm:ss");
  }

  static success(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.green.bold("[SUCCESS]")} ${chalk.white(content)}`,
    );
  }

  static info(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.cyan.bold("[INFO]")}  ${chalk.white(content)}`,
    );
  }

  static warn(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.yellow.bold("[WARN]")}  ${chalk.white(content)}`,
    );
  }

  static error(content, error = null) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.red.bold("[ERROR]")} ${chalk.white(content)}`,
    );
    if (error) {
      console.error(chalk.red(error.stack || error));
    }
  }

  static debug(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.magenta.bold("[DEBUG]")} ${chalk.gray(content)}`,
    );
  }

  static cmd(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.blue.bold("[CMD]")}   ${chalk.white(content)}`,
    );
  }

  static event(content) {
    console.log(
      `${chalk.gray(`[${this.timestamp}]`)} ${chalk.hex("#FFA500").bold("[EVENT]")} ${chalk.white(content)}`,
    );
  }

  static log(content, type = "log") {
    if (this[type]) this[type](content);
    else this.info(content);
  }
}

module.exports = Logger;
