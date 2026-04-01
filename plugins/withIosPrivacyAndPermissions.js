/**
 * Expo config plugin: iOS privacy declarations + unused permission removal.
 *
 * 1. PrivacyInfo.xcprivacy — declares collected data types (email, usage,
 *    identifiers, crash data) required for App Store compliance.
 * 2. Info.plist — removes permission keys for modules removed in PR #21
 *    (expo-calendar, expo-camera, expo-contacts, expo-location, expo-av,
 *    expo-sensors, expo-image-picker, expo-media-library, reminders).
 */
const {
  withInfoPlist,
  withXcodeProject,
  IOSConfig,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ---------- Part 1: PrivacyInfo.xcprivacy collected data types ----------

function withPrivacyManifest(config) {
  return withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.platformProjectRoot;
    const appName = config.modRequest.projectName;
    const privacyPath = path.join(projectRoot, appName, "PrivacyInfo.xcprivacy");

    if (!fs.existsSync(privacyPath)) {
      console.warn(
        "[withIosPrivacyAndPermissions] PrivacyInfo.xcprivacy not found at",
        privacyPath
      );
      return config;
    }

    let content = fs.readFileSync(privacyPath, "utf8");

    // Replace the empty NSPrivacyCollectedDataTypes array with accurate declarations
    const emptyArrayPattern =
      /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/;
    const emptyArrayWithWhitespace =
      /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array>\s*<\/array>/;

    const collectedDataTypes = `<key>NSPrivacyCollectedDataTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeEmailAddress</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeProductInteraction</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<true/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeDeviceID</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
\t\t\t</array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyCollectedDataType</key>
\t\t\t<string>NSPrivacyCollectedDataTypeCrashData</string>
\t\t\t<key>NSPrivacyCollectedDataTypeLinked</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypeTracking</key>
\t\t\t<false/>
\t\t\t<key>NSPrivacyCollectedDataTypePurposes</key>
\t\t\t<array>
\t\t\t\t<string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
\t\t\t</array>
\t\t</dict>
\t</array>`;

    if (emptyArrayPattern.test(content)) {
      content = content.replace(emptyArrayPattern, collectedDataTypes);
    } else if (emptyArrayWithWhitespace.test(content)) {
      content = content.replace(emptyArrayWithWhitespace, collectedDataTypes);
    } else {
      console.warn(
        "[withIosPrivacyAndPermissions] Could not find empty NSPrivacyCollectedDataTypes — may already be populated"
      );
    }

    fs.writeFileSync(privacyPath, content, "utf8");
    return config;
  });
}

// ---------- Part 2: Remove unused Info.plist permission keys ----------

/** Permission keys for modules removed in PR #21 */
const UNUSED_PERMISSION_KEYS = [
  "NSCalendarsFullAccessUsageDescription",
  "NSCalendarsUsageDescription",
  "NSCameraUsageDescription",
  "NSContactsUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "NSLocationAlwaysUsageDescription",
  "NSLocationWhenInUseUsageDescription",
  "NSMicrophoneUsageDescription",
  "NSMotionUsageDescription",
  "NSPhotoLibraryAddUsageDescription",
  "NSPhotoLibraryUsageDescription",
  "NSRemindersFullAccessUsageDescription",
  "NSRemindersUsageDescription",
];

function withCleanInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    for (const key of UNUSED_PERMISSION_KEYS) {
      if (key in config.modResults) {
        delete config.modResults[key];
      }
    }
    return config;
  });
}

// ---------- Combined plugin ----------

function withIosPrivacyAndPermissions(config) {
  config = withCleanInfoPlist(config);
  config = withPrivacyManifest(config);
  return config;
}

module.exports = withIosPrivacyAndPermissions;
