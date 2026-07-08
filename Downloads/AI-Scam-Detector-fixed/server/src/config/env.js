import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// Dev mode runs this file as real ESM (via `tsx`), where a native
// __dirname doesn't exist, so we need import.meta.url there.
// Prod mode bundles this file into CommonJS (esbuild --format=cjs),
// where a native __dirname IS available as a free variable in the
// module wrapper, but import.meta.url is NOT (esbuild just empties
// it out) - calling fileURLToPath on it crashes at startup. That was
// the exact bug breaking Render.
// __dirname is a parameter of the CJS module wrapper esbuild
// generates, so `typeof __dirname` safely detects CJS vs ESM here -
// as long as we assign the result to a *different* variable name
// (configDirname), so we don't shadow/TDZ the outer __dirname while
// checking it.
const configDirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// Support both local server run (from /server or root)
dotenv.config();
dotenv.config({ path: path.resolve(configDirname, "../../.env") });

const defaultDevSecret = "scam-detector-dev-secret-key-778899";
const dynamicSecret = crypto.randomBytes(32).toString("hex");

export const config = {
  port: process.env.PORT || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? dynamicSecret : defaultDevSecret),
};

// Validate critical variables
if (!config.geminiApiKey || config.geminiApiKey === "your_gemini_api_key_here") {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables!");
}

