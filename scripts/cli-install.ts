import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function expandHomeDir(p: string): string {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function isDirInPath(dir: string): boolean {
  const pathEnv = process.env.PATH ?? "";
  const parts = pathEnv.split(path.delimiter).filter(Boolean);
  return parts.includes(dir);
}

function ensureExecutable(filePath: string): void {
  try {
    const st = fs.statSync(filePath);
    const hasExec = (st.mode & 0o111) !== 0;
    if (!hasExec) fs.chmodSync(filePath, 0o755);
  } catch {
    // If we cannot chmod, still try to install; user will hit the error when running.
  }
}

function installSymlink(options: { binaryPath: string; installDir: string; force: boolean }): string {
  const installDir = expandHomeDir(options.installDir);
  fs.mkdirSync(installDir, { recursive: true });

  const dest = path.join(installDir, "cookie-racho");

  if (fs.existsSync(dest)) {
    const st = fs.lstatSync(dest);
    if (st.isSymbolicLink()) {
      fs.unlinkSync(dest);
    } else if (options.force) {
      fs.rmSync(dest, { force: true });
    } else {
      throw new Error(
        `Refusing to overwrite existing file: ${dest}\n` +
          `Remove it manually, or re-run with COOKIE_RACHO_FORCE=1.`
      );
    }
  }

  fs.symlinkSync(options.binaryPath, dest);
  return dest;
}

function main(): void {
  const repoRoot = process.cwd();
  const binaryPath = path.resolve(repoRoot, "dist", "cookie-racho");

  if (!fs.existsSync(binaryPath)) {
    console.error(`Missing compiled binary: ${binaryPath}`);
    console.error("Run: bun run build:compile");
    process.exit(1);
  }

  ensureExecutable(binaryPath);

  const force = process.env.COOKIE_RACHO_FORCE === "1";
  const requestedDir = process.env.COOKIE_RACHO_INSTALL_DIR;

  const candidates = requestedDir
    ? [requestedDir]
    : ["/usr/local/bin", path.join(os.homedir(), ".local", "bin")];

  let dest: string | null = null;
  let lastErr: unknown = null;

  for (const dir of candidates) {
    try {
      dest = installSymlink({ binaryPath, installDir: dir, force });
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!dest) {
    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    console.error(`Failed to install cookie-racho: ${msg}`);
    process.exit(1);
  }

  console.log(`Installed: ${dest} -> ${binaryPath}`);

  const dir = path.dirname(dest);
  if (!isDirInPath(dir)) {
    console.log(`Note: ${dir} is not in your PATH.`);
    console.log(`Add it, or run with: ${binaryPath} --help`);
  } else {
    console.log("Try: cookie-racho --help");
  }
}

main();
