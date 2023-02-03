import { Command } from "commander";
import Config from "../package.json";
import fs from "fs-extra";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

type Version = [number, number, number];

function parseVersion(version: string): Version | undefined {
    const matches = SEMVER.exec(version.trim());
    if (!matches) return;

    return [Number.parseInt(matches[1]), Number.parseInt(matches[2]), Number.parseInt(matches[3])];
}

function compareVersions(a: Version, b: Version): number {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .argument("<version>", "Release version")
        .option("-o, --out [changelog]", "Output current changelog to file", undefined);
    program.parse(process.argv);

    const args = program.args;
    const options = program.opts();

    // remove potentially leading "v"
    let version = args[0];
    if (version.startsWith("v")) version = version.substring(1);

    const newVersion = parseVersion(version);

    if (!newVersion) {
        console.error(`Expected semver version but got ${version}`);
        process.exit(1);
    }

    const lastVersion = parseVersion(Config.version);
    if (lastVersion && compareVersions(newVersion, lastVersion) <= 0) {
        console.error(`Expected a version greater than ${Config.version} but got ${version}`);
        process.exit(1);
    }

    // Update package.json
    Config.version = version;
    await fs.writeFile("package.json", JSON.stringify(Config, undefined, 4));

    // Update changelog
    let changelog = await fs.readFile("CHANGELOG.md", "utf-8");

    // regex for release section
    const regex = /(?<!#)## ([^\r\n]*)/g;
    const match = regex.exec(changelog);

    // bail-out if not not found or the first changelog section already has a different semver
    if (!match) return;
    const changelogVersion = parseVersion(match[1].trim());
    if (changelogVersion && compareVersions(changelogVersion, newVersion) !== 0) {
        console.error(`Changelog already contains changes for a different version: ${match[1]}`);
        process.exit(1);
    }

    const current = match.index;
    const currentEnd = regex.lastIndex;

    const previous = regex.exec(changelog)?.index ?? changelog.length;

    if (options.out) {
        // current changelog is between the first 2 sections
        const latest = changelog.substring(currentEnd, previous).trim() + "\n";
        await fs.writeFile(options.out, latest);
    }

    changelog = changelog.substring(0, current) + `## ${version}` + changelog.substring(currentEnd);
    await fs.writeFile("CHANGELOG.md", changelog);
}

main();
