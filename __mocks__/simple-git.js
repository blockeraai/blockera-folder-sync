const simpleGit = () => ({
    addConfig: jest.fn(),
    clone: jest.fn(),
    diff: jest.fn(),
    checkout: jest.fn(),
    add: jest.fn(),
    commit: jest.fn(),
    push: jest.fn(),
    remote: jest.fn(),
    cwd: jest.fn(),
    raw: jest.fn()
});

module.exports = simpleGit;
