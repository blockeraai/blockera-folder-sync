const fs = require('fs');
const {glob} = require('glob');
const {exec} = require('child_process');

/**
 * Read and Parse blockera-pm.json files to detect paths and dependent repositories lists.
 *
 * @returns {{packageRepos: *[], packagePaths: *[]}} the object with "packagePaths" and "packageRepos" properties.
 */
export const readBlockeraFiles = async () => {
    const packagePaths = [];
    const packageRepos = [];

    // Traverse through directories to find blockera-pm.json files.
    const blockeraFiles = await glob('**/blockera-pm.json');

    blockeraFiles.forEach((blockeraFile) => {
        const data = JSON.parse(fs.readFileSync(blockeraFile, 'utf8'));

        if (data.path) {
            packagePaths.push(data.path);
        }

        if (data.dependent && data.dependent.repositories) {
            packageRepos.push(...data.dependent.repositories);
        }
    });

    return {
        packagePaths,
        packageRepos: [...new Set(packageRepos)],
    };
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
        const rsyncCommand = `rsync -av --progress ${srcDir} ${srcDir} --delete`;
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
