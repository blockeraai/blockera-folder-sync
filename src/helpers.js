const fs = require('fs');
const {glob} = require('glob');
const {exec} = require('child_process');

/**
 * Read and Parse blockera-folder-sync.json files to detect paths and dependent repositories lists.
 *
 * @returns {Array<*>} the array of founded packages.
 */
export const readBlockeraFiles = async () => {
    const packages = {};

    // Traverse through directories to find blockera-folder-sync.json files.
    const blockeraFiles = await glob('**/blockera-folder-sync.json');

    blockeraFiles.forEach((blockeraFile) => {
        const data = JSON.parse(fs.readFileSync(blockeraFile, 'utf8'));

        if (data.path && data.dependent && data.dependent.repositories) {
            for (const repo of data.dependent.repositories) {
                packages[repo] = [
                    ...(packages[repo] || []),
                    data.path
                ];
            }
        }
    });

    return packages;
};

/**
 * Sync package directories using rsync.
 *
 * @param {string} srcDir - Source directory to sync.
 * @param {string} destDir - Destination directory to sync to.
 * @returns {Promise<void>}
 */
export const syncDirectories = (srcDir, destDir) => {
    return new Promise((resolve, reject) => {
        const rsyncCommand = `rsync -av --progress ${srcDir} ${destDir} --delete`;
        exec(rsyncCommand, (error, stdout, stderr) => {
            if (error) {
                reject(`Error syncing directories: ${stderr}`);
            } else {
                console.log(`rsync output: ${stdout}`);
                resolve();
            }
        });
    });
};
