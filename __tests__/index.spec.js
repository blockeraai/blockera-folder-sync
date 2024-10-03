const fs = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');
const simpleGit = require('simple-git');

// Mock core functionality.
jest.mock('fs');
jest.mock('path');
jest.mock('simple-git');
jest.mock('@actions/core');
jest.mock('@actions/github');

const action = require('../src/main');
const helpers = require('../src/helpers');

describe('Sync Packages Action', () => {
	afterEach(() => {
		jest.clearAllMocks(); // Clear mocks before each test.
	});

	test('should setup git user config correctly', () => {
		const git = simpleGit();

		action.run().then(() => {
			// Test that git.addConfig was called with correct arguments.
			expect(git.addConfig).toHaveBeenCalledWith('user.name', 'blockerabot', undefined, {
				global: true
			});
			expect(git.addConfig).toHaveBeenCalledWith(
				'user.email',
				'blockeraai+githubbot@gmail.com',
				undefined,
				{ global: true }
			);

			expect(git.addConfig).toHaveBeenCalledTimes(4);
		});
	});

	test('should read blockera-folder-sync.json files and return package paths', () => {
		const blockeraJson = JSON.stringify({
			path: 'path/to/package',
			dependent: { repositories: ['repo1', 'repo2'] }
		});
		const mockReaddirSync = jest
			.spyOn(fs, 'readdirSync')
			.mockReturnValue(['blockera-folder-sync.json']);
		const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockReturnValue(blockeraJson);

		helpers.readBlockeraFiles().then(({ packagePaths, packageRepos }) => {
			expect(packagePaths).toEqual(['path/to/package']);
			expect(packageRepos).toEqual(['repo1', 'repo2']);
			expect(mockReaddirSync).toHaveBeenCalled();
			expect(mockReadFileSync).toHaveBeenCalled();
		});
	});

	test('should detect changes in packages', () => {
		const git = simpleGit();
		git.diff.mockResolvedValue('path/to/package/file.js');

		helpers.readBlockeraFiles().then(() => {
			action.run().then(() => {
				expect(git.diff).toHaveBeenCalledWith(['--name-only', 'HEAD^', 'HEAD']);
				expect(core.info).toHaveBeenCalledWith(
					'Changes detected in package at path/to/package'
				);
				expect(jest.spyOn(fs, 'readFileSync').mockReturnValue()).toHaveBeenCalled();
			});
		});
	});

	test('should push changes and create a pull request', () => {
		const git = simpleGit();
		const octokit = github.getOctokit();

		action.run().then(() => {
			expect(git.push).toHaveBeenCalledWith('origin', 'sync-packages-from-primary');
			expect(octokit.pulls.create).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Sync package from Primary Repo'
				})
			);
		});
	});
});
