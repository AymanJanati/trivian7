import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
let remote;
try {
  remote = execFileSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
  }).trim();
} catch {
  throw new Error(
    "Publish this repository to GitHub and add its real origin first.",
  );
}
remote = remote
  .replace(/^git@github.com:/, "https://github.com/")
  .replace(/\.git$/, "");
if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(remote))
  throw new Error("Expected an actual GitHub repository origin.");
const privateRepository = process.argv.includes("--private");
const url = privateRepository
  ? "https://vercel.com/new"
  : "https://vercel.com/new/clone?repository-url=" +
    encodeURIComponent(remote) +
    "&env=ADMIN_PASSWORD,SESSION_SIGNING_SECRET";
const button =
  `[![Deploy with Vercel](https://vercel.com/button)](${url})` +
  (privateRepository
    ? `\n\nPrivate repository: sign in and import [${remote.split("/").slice(-2).join("/")}](${remote}).`
    : "");
const readme = readFileSync("README.md", "utf8");
writeFileSync(
  "README.md",
  readme.replace(
    /<!-- deploy-button:start -->[\s\S]*?<!-- deploy-button:end -->/,
    `<!-- deploy-button:start -->\n${button}\n<!-- deploy-button:end -->`,
  ),
);
console.log(
  "Updated README with deploy button for the configured GitHub origin.",
);
