import fsp from "node:fs/promises";
import path from "node:path";
import packageJson from "../package.json" assert { type: "json" };

const PYPROJECT_FILE = path.join(
  import.meta.dirname,
  "../extensions-static/comfy-ui/pyproject.toml",
);

const pyProject = await fsp.readFile(PYPROJECT_FILE, "utf-8");

await fsp.writeFile(
  PYPROJECT_FILE,
  pyProject.replace(
    /^version = "(.+)"$/m,
    `version = ${JSON.stringify(packageJson.version)}`,
  ),
  "utf-8",
);
