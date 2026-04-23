import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const versionPath = path.join(rootDir, "app-version.json");
const iosDir = path.join(rootDir, "ios");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function updateInfoPlist(filePath, version, buildNumber) {
  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)([^<]*)(<\/string>)/,
    `$1${version}$3`,
  );
  text = text.replace(
    /(<key>CFBundleVersion<\/key>\s*<string>)([^<]*)(<\/string>)/,
    `$1${buildNumber}$3`,
  );
  fs.writeFileSync(filePath, text);
}

function updatePbxproj(filePath, version, buildNumber) {
  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
  text = text.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
  fs.writeFileSync(filePath, text);
}

function firstFileMatching(dirPath, ext) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(ext)) return path.join(dirPath, entry.name);
  }
  return null;
}

function main() {
  if (!fs.existsSync(versionPath)) {
    throw new Error(`Missing ${versionPath}`);
  }

  const cfg = readJson(versionPath);
  const version = String(cfg.version ?? "").trim();
  const buildNumber = String(cfg.iosBuildNumber ?? "").trim();
  if (!version || !buildNumber) {
    throw new Error("app-version.json must include non-empty version and iosBuildNumber");
  }

  if (!fs.existsSync(iosDir)) {
    console.log("No ios directory found; skipping native sync.");
    return;
  }

  const infoPlistPath = path.join(iosDir, "RayMobile", "Info.plist");
  if (fs.existsSync(infoPlistPath)) {
    updateInfoPlist(infoPlistPath, version, buildNumber);
    console.log(`Updated ${path.relative(rootDir, infoPlistPath)}`);
  } else {
    console.log(`Info.plist not found at ${path.relative(rootDir, infoPlistPath)}; skipping.`);
  }

  let pbxprojPath = null;
  const explicit = path.join(iosDir, "RayMobile.xcodeproj", "project.pbxproj");
  if (fs.existsSync(explicit)) {
    pbxprojPath = explicit;
  } else {
    const xcodeproj = firstFileMatching(iosDir, ".xcodeproj");
    if (xcodeproj) pbxprojPath = path.join(xcodeproj, "project.pbxproj");
  }

  if (pbxprojPath && fs.existsSync(pbxprojPath)) {
    updatePbxproj(pbxprojPath, version, buildNumber);
    console.log(`Updated ${path.relative(rootDir, pbxprojPath)}`);
  } else {
    console.log("project.pbxproj not found; skipping.");
  }
}

main();
