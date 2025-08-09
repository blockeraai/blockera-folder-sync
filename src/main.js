import { getOpenedPullRequest } from './helpers';

const { info, setFailed, getInput } = require('@actions/core');
const github = require('@actions/github');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const { syncDirectories, readBlockeraFiles, logInfo } = require('./helpers');

const switchToSyncBranch = async (git, branchName, createSyncBranch, baseBranch) => {
	if (createSyncBranch === 'true') {
		logInfo('loading', `Create branch: ${branchName}`);

		try {
			await git.checkout(['-b', branchName]);
		} catch (error) {
			if (/A branch named '.*' already exists\./gi.test(error.message)) {
				logInfo('loading', `Switch to exists branch ${branchName}`);
				await git.checkout([branchName]);

				logInfo('loading', `Git Pull from origin/${branchName}`);
				await git.pull('origin', branchName, ['--no-rebase']);
			} else {
				throw error;
			}
		}
	} else {
		logInfo('loading', `Switching to base branch: ${baseBranch}`);
		await git.checkout([baseBranch]);
		await git.pull('origin', baseBranch, ['--no-rebase']);
	}
};

const commit = async (git, { repo, branchName, repoIdMatches }) => {
	const repoStatus = await git.status();
	const createSyncBranch = getInput('CREATE_SYNC_BRANCH');
	const baseBranch = getInput('BASE_BRANCH');

	if (repoStatus.isClean()) {
		logInfo('success', 'Your repository is Clean.');
		return;
	}

	try {
		// Commit changes.
		await git.add('./*');
		await git.commit(`Sync shared packages from ${github.context.repo.repo}`);
		logInfo('success', `Commit Changelogs.`);

		// Push changes
		const targetBranch = createSyncBranch === 'true' ? branchName : baseBranch;
		await git.push(['--set-upstream', 'origin', targetBranch]);
		logInfo('success', `Changes pushed to ${repo}`);

		// Only create PR if we're using a sync branch
		if (createSyncBranch === 'true') {
			const openPRs = await getOpenedPullRequest();
			if (!openPRs.length) {
				// Use octokit to create a pull request.
				const octokit = github.getOctokit(getInput('TOKEN'));
				await octokit.rest.pulls.create({
					owner: github.context.repo.owner,
					repo: repoIdMatches[1],
					title: `Sync package from ${github.context.repo.repo} Repo`,
					head: branchName,
					base: baseBranch,
					body: `This PR syncs the package from the [${github.context.repo.repo}](https://github.com/blockeraai/${github.context.repo.repo}) repository.`
				});

				logInfo(
					'success',
					`Created The Sync package from ${github.context.repo.repo} Repo Pull Request.`
				);
			}
		}
	} catch (error) {
		logInfo('error', error.message);
		throw error;
	}
};

/**
 * Main function to handle the GitHub Action workflow.
 *
 * @returns {Promise<void>}
 */
export const run = async () => {
	try {
		// Set up Git configuration.
		const git = simpleGit({
			binary: 'git'
		});

		// Apply the user.name and user.email globally
		await git.addConfig('user.name', getInput('USERNAME'), undefined, { global: true });
		await git.addConfig('user.email', getInput('EMAIL'), undefined, { global: true });

		// Get the current repository information from the context.
		const { owner, repo: repoId } = github.context.repo;

		// Construct the HTTPS URL for the current repository.
		const currentRepoURL = `https://github.com/${owner}/${repoId}.git`;

		// Read blockera-folder-sync.json files from current repository!
		const packages = await readBlockeraFiles(getInput('STATIC_REPOSITORY'));
		logInfo('info', `Package paths are ${JSON.stringify(packages)}`);

		// Clone dependent repos and sync changes.
		for (const repo in packages) {
			const packagePaths = packages[repo];

			// Skip current repository!
			if (repo === currentRepoURL) {
				continue;
			}

			const repoIdMatches = /\/([a-zA-Z0-9_-]+)\.git$/.exec(repo);

			if (!repoIdMatches || !repoIdMatches[0] || !repoIdMatches[1]) {
				continue;
			}

			const repoDir = path.join('./', repoIdMatches[1]);
			const repositoryURL = repo.replace(/http(?:s|):\/\//gi, '');
			const repoPath = `https://x-access-token:${getInput('TOKEN')}@${repositoryURL}`;

			try {
				await git.clone(repoPath, repoDir);

				// Use a new git instance in the repo directory.
				const repoGit = simpleGit({
					baseDir: repoDir, // set working dir properly.
					binary: 'git'
				});

				await repoGit.cwd(repoDir);
				await repoGit.remote(['set-url', 'origin', repoPath]);
				await repoGit.addConfig('user.name', getInput('USERNAME'), undefined, {
					global: true
				});
				await repoGit.addConfig('user.email', getInput('EMAIL'), undefined, {
					global: true
				});

				const branchName = `sync-packages-from-${github.context.repo.repo}`;
				const createSyncBranch = getInput('CREATE_SYNC_BRANCH');
				const baseBranch = getInput('BASE_BRANCH');

				await switchToSyncBranch(repoGit, branchName, createSyncBranch, baseBranch);

				// Check if there is at least one commit.
				const log = await git.log();

				// Sync package directories.
				for (const packagePath of packagePaths) {
					if (log.total === 0) {
						logInfo('info', 'No commits in the repository.');
						continue;
					}

					logInfo('loading', 'Repository in progress: ' + repo);

					const srcDir = path.join('./', packagePath);
					const destDir = path.join(repoDir, 'packages');

					// Syncing packages ...
					await syncDirectories(srcDir, destDir);
					logInfo(
						'success',
						`Synced package from ${srcDir} to ${destDir} of ${repo} repository ✅`
					);
				}

				await commit(repoGit, {
					repo,
					branchName,
					repoIdMatches
				});
			} catch (error) {
				logInfo('error', `Failed processing repo ${repo}: ${error.message}`);
			}

			// Clean up the cloned repo after processing
			if (fs.existsSync(repoDir)) {
				fs.rmSync(repoDir, { recursive: true, force: true });
				logInfo('info', `Cleaned up local repo folder: ${repoDir}`);
			}
		}
	} catch (error) {
		logInfo('error', error.message);
		setFailed(error.message);
		throw error;
	}
};

run().catch((error) => {
	logInfo('error', error.message);
	setFailed(error.message);
});
