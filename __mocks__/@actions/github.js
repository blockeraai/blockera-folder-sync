const github = {
    getOctokit: jest.fn().mockReturnValue({
        pulls: {
            create: jest.fn()
        }
    })
};
module.exports = github;