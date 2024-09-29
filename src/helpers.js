const path = require('path');
const fs = require('fs');

/**
 * Read and Parse blockera-pm.json files to detect paths and dependent repositories lists.
 *
 * @returns {{packageRepos: *[], packagePaths: *[]}} the object with "packagePaths" and "packageRepos" properties.
 */
const readBlockeraFiles = () => {
    const files = [];
    const packagePaths = [];
    const packageRepos = [];

    // Traverse through directories to find blockera-pm.json files.
    const searchDir = path.resolve('./packages/');
    const blockeraFiles = fs.readdirSync(searchDir).filter(file => file === 'blockera-pm.json');

    blockeraFiles.forEach(blockeraFile => {
        const filePath = path.join(searchDir, blockeraFile);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (data.path) packagePaths.push(data.path);
        if (data.dependent && data.dependent.repositories) packageRepos.push(...data.dependent.repositories);
    });

    return {
        packagePaths,
        packageRepos,
    };
};


module.exports = {
    readBlockeraFiles
};
