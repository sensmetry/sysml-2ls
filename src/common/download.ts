/********************************************************************************
 * Copyright (c) 2022-2023 Sensmetry UAB and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License, v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is
 * available at https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import os from "os";
import yauzl from "yauzl";

const PREFIXES = ["", "k", "M", "G", "T"];

/**
 * Format number of bytes to a string with units appended
 * @param bytes number of bytes, assuming integer
 * @param fractionDigits number of digits after the decimal point
 * @returns formatted string with units
 */
export function formatBytes(bytes: number, fractionDigits = 2): string {
    let prefix = 0;
    while (bytes >= 1024) {
        bytes /= 1024;
        prefix++;
    }

    if (prefix === 0) {
        // assume an integer number of bytes
        return `${bytes.toString()} B`;
    }

    return `${bytes.toFixed(fractionDigits)} ${PREFIXES[prefix]}B`;
}

/**
 * @returns temporary directory that can be used for downloads
 */
export function tmpdir(): string {
    const dir = path.join(os.tmpdir(), "Sensmetry");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    return dir;
}

/**
 * @returns directory that can be used to for persistent caching
 */
export function cacheDir(): string {
    const dir = path.join(os.homedir(), ".sysml-2ls");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    return dir;
}

export interface DownloadInfo {
    /**
     * Path to the downloaded file
     */
    path: string;

    /**
     * Content type
     */
    mime?: string;

    /**
     * Download size in bytes
     * @see {@link formatBytes}
     */
    size: number;
}

const DEFAULT_PROGRESS_REPORT_PERIOD = 100; // ms
interface ProgressReporter {
    /**
     * Progress reporter function
     * @param bytes total number of bytes read
     * @param size the download size
     */
    progress: (bytes: number, size: number) => void;

    /**
     * Progress report period in ms
     */
    period?: number;
}

/**
 * Download a file from a given web URL
 * @param url http or https url to a file
 * @param targetFile path where file will be downloaded to
 * @param reporter progress reporter
 * @returns a promise that resolves to {@link DownloadInfo}
 */
export async function downloadFile(
    url: string,
    targetFile: string,
    reporter?: ProgressReporter
): Promise<DownloadInfo> {
    const proto = url.startsWith("https") ? https : http;

    return await new Promise((resolve, reject) => {
        const request = proto.get(url, (response) => {
            const code = response.statusCode ?? 0;

            if (code >= 400) {
                return reject(new Error(response.statusMessage));
            }

            // handle redirects
            if (code > 300 && code < 400 && !!response.headers.location) {
                return resolve(downloadFile(response.headers.location, targetFile, reporter));
            }

            if (code !== 200) {
                return reject(new Error(`Failed to get '${url}' (${code})`));
            }

            const info: DownloadInfo = {
                path: targetFile,
                mime: response.headers["content-type"],
                size: parseInt(`${response.headers["content-length"]}`, 10),
            };

            if (reporter) {
                const watch = setInterval(() => {
                    reporter.progress(response.socket.bytesRead, info.size);
                }, reporter.period ?? DEFAULT_PROGRESS_REPORT_PERIOD);
                response.on("close", () => {
                    clearInterval(watch);
                });
            }

            // save the file to disk, also remove the failed files on any errors
            const fileWriter = fs
                .createWriteStream(targetFile)
                .on("close", () => {
                    resolve(info);
                })
                .on("error", (err) => {
                    fs.unlink(targetFile, () => reject(err));
                });

            response.pipe(fileWriter).on("error", (err) => {
                fs.unlink(targetFile, () => reject(err));
            });
        });

        request.end();
    });
}

/**
 * Unzip a file from {@link source} to {@link destination} folder
 * @param source Archive to extract
 * @param destination Destination directory
 * @param redirector Optional entry redirector, returned strings are treated as
 * relative paths to {@link destination} to extract that particular entry to,
 * and returning undefined skips the entry
 */
export async function unzipFile(
    source: string,
    destination: string,
    redirector?: (entry: yauzl.Entry) => string | undefined
): Promise<void> {
    return new Promise((resolve, reject) => {
        yauzl.open(source, { lazyEntries: true }, (err, zipFile) => {
            if (err) {
                reject(err);
                return;
            }

            zipFile.on("close", resolve).on("error", reject);
            zipFile.readEntry();

            zipFile.on("entry", (entry: yauzl.Entry) => {
                if (/\/$/.test(entry.fileName)) {
                    // Directory file names end with '/'.
                    // Note that entries for directories themselves are optional.
                    // An entry's fileName implicitly requires its parent directories to exist.
                    zipFile.readEntry();
                } else {
                    // file entry
                    const relPath = redirector ? redirector(entry) : entry.fileName;
                    if (!relPath) {
                        zipFile.readEntry();
                        return;
                    }

                    zipFile.openReadStream(entry, async function (err, readStream) {
                        if (err) {
                            reject(err);
                            return;
                        }

                        readStream.on("end", function () {
                            zipFile.readEntry();
                        });

                        // setup destination directory
                        const out = path.join(destination, relPath);
                        const outdir = path.dirname(out);
                        let exists = true;
                        await fs.promises.stat(outdir).catch(() => (exists = false));
                        if (!exists)
                            await fs.promises.mkdir(outdir, { recursive: true }).catch(reject);

                        // extract the entry
                        readStream.pipe(fs.createWriteStream(out));
                    });
                }
            });
        });
    });
}
