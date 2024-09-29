// read and parse blockera-pm.json
export const readBlockeraFiles = () => {
    const files = [];
    const packagePaths = [];
    const packageRepos = [];

    // Traverse through directories to find blockera-pm.json files
    const searchDir = path.resolve('./path/to/shared/packages/');
    const blockeraFiles = fs.readdirSync(searchDir).filter(file => file === 'blockera-pm.json');

    blockeraFiles.forEach(blockeraFile => {
        const filePath = path.join(searchDir, blockeraFile);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (data.path) packagePaths.push(data.path);
        if (data.dependent && data.dependent.repositories) packageRepos.push(...data.dependent.repositories);
    });

    return { packagePaths, packageRepos };
};
