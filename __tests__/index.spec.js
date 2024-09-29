const core = require('@actions/core');
const github = require('@actions/github');
const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

// Mock core functionality.
jest.mock('@actions/core');
jest.mock('@actions/github');
// jest.mock('simple-git');
jest.mock('fs');

const action = require('../src/main');  // Import your actual GitHub Action logic.
const helpers = require('../src/helpers');

describe('Sync Packages Action', () => {
    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks before each test.
    });

    test.only('should setup git user config correctly', async () => {
        const git = simpleGit();

        await action.run();  // Call the function you're testing.

        // Test that git.addConfig was called with correct arguments.
        expect(git.addConfig).toHaveBeenCalledWith('user.name', 'blockerabot');
        expect(git.addConfig).toHaveBeenCalledWith('user.email', 'blockeraai+githubbot@gmail.com');
    });

    test('should read blockera-pm.json files and return package paths', () => {
        const blockeraJson = JSON.stringify({
            path: 'path/to/package',
            dependent: { repositories: ['repo1', 'repo2'] }
        });
        const mockReaddirSync = jest.spyOn(fs, 'readdirSync').mockReturnValue(['blockera-pm.json']);
        const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(blockeraJson);

        const { packagePaths, packageRepos } = helpers.readBlockeraFiles();

        expect(packagePaths).toEqual(['path/to/package']);
        expect(packageRepos).toEqual(['repo1', 'repo2']);
        expect(mockReaddirSync).toHaveBeenCalled();
        expect(mockReadFileSync).toHaveBeenCalled();
    });

    test('should detect changes in packages', async () => {
        const git = simpleGit();
        git.diff.mockResolvedValue('path/to/package/file.js');

        const { packagePaths } = helpers.readBlockeraFiles();
        await action.run();  // Run your action logic

        expect(git.diff).toHaveBeenCalledWith(['--name-only', 'HEAD^', 'HEAD']);
        expect(core.info).toHaveBeenCalledWith('Changes detected in package at path/to/package');
    });

    test('should push changes and create a pull request', async () => {
        const git = simpleGit();
        const octokit = github.getOctokit();

        await action.run();  // Run your action

        expect(git.push).toHaveBeenCalledWith('origin', 'sync-packages-from-primary');
        expect(octokit.pulls.create).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Sync package from Primary Repo'
        }));
    });
});