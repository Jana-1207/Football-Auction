const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env");
const outputPath = path.join(projectRoot, "js", "app-config.js");

function parseEnvFile(content) {
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

if (!fs.existsSync(envPath)) {
  console.error("Missing .env file. Copy .env.example to .env and fill in your values.");
  process.exit(1);
}

const env = parseEnvFile(fs.readFileSync(envPath, "utf8"));
const supabaseUrl = env.SUPABASE_URL || "";
const supabaseAnonKey = env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE_URL and SUPABASE_ANON_KEY are required in .env.");
  process.exit(1);
}

const output = `window.APP_CONFIG = ${JSON.stringify(
  {
    supabaseUrl,
    supabaseAnonKey
  },
  null,
  2
)};\n`;

fs.writeFileSync(outputPath, output, "utf8");
console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
