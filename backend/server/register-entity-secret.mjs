import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  registerEntitySecretCiphertext,
} from "@circle-fin/developer-controlled-wallets";

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    throw new Error("CIRCLE_API_KEY is required in the environment.");
  }

  const entitySecret = crypto.randomBytes(32).toString("hex");
  console.log("Generated entity secret:", entitySecret);

  const recoveryPath = path.resolve("./recovery");
  fs.mkdirSync(recoveryPath, { recursive: true });

  const response = await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryPath,
  });

  console.log("Registered entity secret with Circle.");
  console.log("Recovery file saved to:", recoveryPath);
  console.log("Response:", JSON.stringify(response?.data ?? response, null, 2));
  console.log(
    "Save this entity secret into backend/server/.env as CIRCLE_ENTITY_SECRET."
  );
}

main().catch((err) => {
  console.error("Error registering entity secret:", err?.message || err);
  process.exit(1);
});
