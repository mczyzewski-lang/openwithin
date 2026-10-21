import "server-only";
import { spawn } from "node:child_process";
import { env } from "../env";

export class FfmpegError extends Error {}

export function run(bin: string, args: string[], timeoutMs = 10 * 60_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new FfmpegError(`${bin} timed out`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 20000) stderr = stderr.slice(-10000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new FfmpegError(`${bin} failed to start: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new FfmpegError(`${bin} exited with ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export const ffmpeg = (args: string[], timeoutMs?: number) =>
  run(env.FFMPEG_PATH, ["-hide_banner", "-loglevel", "error", "-y", ...args], timeoutMs);

export async function probeDurationMs(file: string): Promise<number> {
  const { stdout } = await run(env.FFPROBE_PATH, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], 30_000);
  const sec = parseFloat(stdout.trim());
  if (!Number.isFinite(sec)) throw new FfmpegError(`could not probe ${file}`);
  return Math.round(sec * 1000);
}
