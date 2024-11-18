const github = {
    getOctokit: jest.fn().mockReturnValue({
        pulls: {
            create: jest.fn()
        }
    }),
    context: {
        repo: 'blockera-folder-sync'
    }
};
module.exports = github;
