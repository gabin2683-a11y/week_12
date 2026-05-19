const fs = require("fs");
const path = require("path");

function openLog(filename) {
  const logsDir = path.join(__dirname, "..", "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  const logPath = path.join(logsDir, filename);
  const stream = fs.createWriteStream(logPath, { flags: "w" });

  const write = (msg) => {
    const line = String(msg);
    console.log(line);
    stream.write(line + "\n");
  };
  const close = () =>
    new Promise((resolve) => stream.end(resolve));

  return { write, close, path: logPath };
}

function fmtEth(ethers, wei) {
  return ethers.formatEther(wei) + " ETH";
}

module.exports = { openLog, fmtEth };
