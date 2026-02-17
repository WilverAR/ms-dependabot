const fs = require("fs");
const path = require("path");

const alertsPath = path.join(process.cwd(), "dependabot-alerts.json");
const buildGradlePath = path.join(process.cwd(), "build.gradle");

if (!fs.existsSync(alertsPath)) {
  console.error("dependabot-alerts.json not found.");
  process.exit(1);
}

if (!fs.existsSync(buildGradlePath)) {
  console.error("build.gradle not found.");
  process.exit(1);
}

const alerts = JSON.parse(fs.readFileSync(alertsPath, "utf8"));
let buildGradle = fs.readFileSync(buildGradlePath, "utf8");

let changed = false;
let applied = 0;
let skipped = 0;

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const alert of alerts) {
  const name = alert.name;
  const fixed = alert.fixed_version;
  if (!name || !fixed) {
    skipped += 1;
    continue;
  }

  const parts = name.split(":");
  if (parts.length !== 2) {
    skipped += 1;
    continue;
  }

  const [group, artifact] = parts;
  const pattern = new RegExp(
    `(['"])${escapeRegExp(group)}:${escapeRegExp(artifact)}:([^'"]+)\\1`,
    "g"
  );

  const next = buildGradle.replace(pattern, `$1${group}:${artifact}:${fixed}$1`);
  if (next !== buildGradle) {
    buildGradle = next;
    changed = true;
    applied += 1;
  } else {
    skipped += 1;
  }
}

if (changed) {
  fs.writeFileSync(buildGradlePath, buildGradle);
}

const summary = {
  total_alerts: alerts.length,
  applied,
  skipped,
};

console.log(JSON.stringify(summary, null, 2));

const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  fs.appendFileSync(outputPath, `changed=${changed}\n`);
  fs.appendFileSync(outputPath, `applied=${applied}\n`);
  fs.appendFileSync(outputPath, `skipped=${skipped}\n`);
}
