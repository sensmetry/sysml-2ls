#!/usr/bin/env node

import { exec, ExecSyncOptions } from "child_process";
import fs from "fs-extra";
import path from "path";
import util from "util";

const execPromise = util.promisify(exec);

const CHILD_OPTIONS: ExecSyncOptions = {
    stdio: [0, "pipe", 2],
};

type Hook = () => void | Promise<void>;
const FILE_HOOKS: Partial<Record<string, Hook>> = {};

function fileHook(name: string) {
    return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor): void {
        FILE_HOOKS[name] = descriptor.value;
    };
}

const GITHUB_ISSUE_TEMPLATE_DIR = ".github/ISSUE_TEMPLATE";
const GITHUB_PR_TEMPLATE_DIR = ".github/PULL_REQUEST_TEMPLATE";

async function copyWithHeader(src: string, dst: string, header?: string): Promise<void> {
    let contents = await fs.readFile(src, "utf-8");
    if (header) contents = header + "\n\n" + contents;
    await fs.writeFile(dst, contents);
}

//@ts-expect-error unused class but needed to let decorators be applied to methods
class GitHooks {
    @fileHook("README.md")
    static async readmeHook(): Promise<void> {
        let contents = await fs.readFile("README.md", "utf-8");
        contents = contents.replace(/(^#[^#\n\r]*)$/m, (sub) => {
            return (
                sub +
                "\n\n**NOTE: this is a mirror repository.** The main repository is hosted [here on Gitlab](https://gitlab.com/sensmetry/public/sysml-2ls)."
            );
        });
        contents = contents.replace(/(src="\.)/m, (sub) => {
            return (
                sub +
                "."
            );
        });

        await fs.writeFile(".github/README.md", contents);
    }

    @fileHook(".gitlab/issue_templates/bug_report.md")
    static async bugReportHook(): Promise<void> {
        await copyWithHeader(
            ".gitlab/issue_templates/bug_report.md",
            path.join(GITHUB_ISSUE_TEMPLATE_DIR, "bug_report.md"),
            `
---
name: Bug report
about: Create a report to help us improve
title: ''
labels: ''
assignees: ''

---`.trim()
        );
    }

    @fileHook(".gitlab/issue_templates/feature_request.md")
    static async featureRequestHook(): Promise<void> {
        await copyWithHeader(
            ".gitlab/issue_templates/feature_request.md",
            path.join(GITHUB_ISSUE_TEMPLATE_DIR, "feature_request.md"),
            `
---
name: Feature request
about: Suggest an idea for this project
title: ''
labels: ''
assignees: ''

---`.trim()
        );
    }

    @fileHook(".gitlab/merge_request_templates/merge_request.md")
    static async mergeRequestHook(): Promise<void> {
        await copyWithHeader(
            ".gitlab/merge_request_templates/merge_request.md",
            path.join(GITHUB_PR_TEMPLATE_DIR, "pull_request_template.md"),
            `
---
name: Pull request
about: Improve this project
title: ''
labels: ''
assignees: ''

---`.trim()
        );
    }
}

async function execHook(hook: Hook): Promise<void> {
    return hook();
}

async function main(): Promise<void> {
    const child = await execPromise("git diff --name-only --cached", CHILD_OPTIONS);
    const staged = child.stdout.split(/\r?\n/).filter((name) => name.length > 0);

    const hooks = staged
        .map((file) => FILE_HOOKS[file])
        .filter((hook) => hook !== undefined) as Hook[];

    if (hooks.length === 0) return;

    // stash unstaged changes
    await execPromise("git stash -u -q --keep-index", CHILD_OPTIONS);

    // run hooks
    let failed = false;
    await Promise.all(hooks.map((hook) => execHook(hook)))
        .then(async () => {
            // stage changed files
            await execPromise("git add -u", CHILD_OPTIONS);
        })
        .catch((reason) => {
            console.error(reason);
            if (reason instanceof Error) console.error(reason.stack);
            failed = true;
        })
        .finally(async () => {
            // re-apply original unstaged changes
            await execPromise("git stash pop -q", CHILD_OPTIONS);
        });

    if (failed) process.exit(1);
}

main();
