import { SlackAPI } from "deno-slack-api/mod.ts";
import { load } from "std/dotenv";

/**
 * Script to deploy/update the Slack app manifest.
 * It reads the configuration from manifest.json and updates the app on Slack.
 */
async function deploy() {
  console.log("🚀 Starting Slack app manifest deployment...");

  // Load environment variables from .env
  await load({ export: true, allowEmptyValues: true });

  const token = Deno.env.get("SLACK_CONFIG_TOKEN") ||
    Deno.env.get("SLACK_USER_TOKEN");
  if (!token) {
    console.error(
      "❌ Error: SLACK_CONFIG_TOKEN or SLACK_USER_TOKEN is not set.",
    );
    console.log("Please add SLACK_CONFIG_TOKEN=xoxp-... to your .env file.");
    console.log(
      "This token needs 'manifests:write' scope (usually a configuration token).",
    );
    return;
  }

  // 1. Read manifest.json
  let manifest;
  try {
    const manifestContent = await Deno.readTextFile("./manifest.json");
    manifest = JSON.parse(manifestContent);
    console.log("✅ Read manifest.json successfully.");
  } catch (error) {
    console.error(
      "❌ Error reading manifest.json:",
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  // 2. Get App ID
  let appId = Deno.env.get("SLACK_APP_ID");
  if (!appId) {
    try {
      const appsContent = await Deno.readTextFile("./.slack/apps.json");
      const appsData = JSON.parse(appsContent);

      // Try to get from apps object (first one found or default)
      const apps = appsData.apps || {};
      const teamIds = Object.keys(apps);

      if (teamIds.length > 0) {
        // Prefer the default if specified, otherwise take the first one
        const defaultTeam = appsData.default;
        const targetTeam = (defaultTeam && apps[defaultTeam]) ? defaultTeam : teamIds[0];
        appId = apps[targetTeam].app_id;
        console.log(
          `ℹ️ Found App ID ${appId} from .slack/apps.json (Team: ${targetTeam})`,
        );
      }
    } catch (_e) {
      // Ignore error, will check if appId exists below
    }
  }

  if (!appId) {
    console.error(
      "❌ Error: SLACK_APP_ID is not set and could not be found in .slack/apps.json.",
    );
    console.log(
      "Please set SLACK_APP_ID in your .env or run 'slack link' if using Slack CLI.",
    );
    return;
  }

  // 3. Update Manifest
  const client = SlackAPI(token);

  console.log(`📡 Updating manifest for App ID: ${appId}...`);

  try {
    const response = await client.apps.manifest.update({
      app_id: appId,
      manifest: JSON.stringify(manifest),
    });

    if (response.ok) {
      console.log("✨ Successfully updated app manifest!");
      console.log(`🔗 App Management URL: https://api.slack.com/apps/${appId}`);
    } else {
      console.error("❌ Failed to update manifest:", response.error);
      if (response.errors) {
        console.log("Validation Errors:");
        response.errors.forEach((err: string) => console.log(`  - ${err}`));
      }
    }
  } catch (error) {
    console.error(
      "❌ An unexpected error occurred during deployment:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

if (import.meta.main) {
  deploy();
}
