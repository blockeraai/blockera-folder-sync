import {getOpenedPullRequest} from "./helpers";

const {info, setFailed, getInput} = require('@actions/core');
const github = require('@actions/github');
const simpleGit = require('simple-git');
const path = require('path');
const {syncDirectories, readBlockeraFiles} = require('./helpers');

const STATUSES = {
    loading: '⌛ ',
    info: 'ℹ️ Info: ',
    error: '🚨 ERROR: ',
    warning: '⚠️ WARNING: ',
    success: '✅ SUCCESS: ',
}

const logInfo = (status, data) => {
    if ('string' === typeof data) {
        console.log(STATUSES[status] + data);

        return;
    }

    console.log(STATUSES[status], data);
}

const switchToSyncBranch = async (git, branchName) => {
    logInfo('loading', `Create branch: ${branchName}`);

    try {
        git.checkout(['-b', branchName]);
    } catch (error) {
        if (/A branch named '.*' already exists\./gi.test(e.message)) {
            logInfo('loading', `Switch to exists branch ${branchName}`);
            await git.checkout([branchName]);

            logInfo('loading', `Git Pull from origin/${branchName}`);
            await git.pull('origin', branchName, ['--no-rebase']);
        } else {
            throw new Error(error);
        }
    }
}

const commit = async (git, {
    repo,
    branchName,
    repoIdMatches,
}) => {
    const repoStatus = await git.status();

    if (repoStatus.isClean()) {
        logInfo('success', 'Your repository is Clean.');
        return;
    }

    // Commit changes.
    await git.add('./*').catch((error) => {
        logInfo('error', error.message);
    });
    await git.commit(`Sync shared packages from ${github.context.repo.repo}`).catch((error) => {
        logInfo('error', error.message);
    });
    logInfo('success', `Commit Changelogs.`);

    // Push changes and create PR.
    await git.push('origin', branchName).catch((error) => {
        logInfo('error', error.message);
    });
    logInfo('success', `Changes pushed to ${repo}`);

    getOpenedPullRequest().then((data) => {
        if (!data.length) {
            try {
                // Use octokit to create a pull request.
                const octokit = github.getOctokit(getInput('TOKEN'));
                octokit.rest.pulls.create({
                    owner: github.context.repo.owner,
                    repo: repoIdMatches[1],
                    title: `Sync package from ${github.context.repo.repo} Repo`,
                    head: `sync-packages-from-${github.context.repo.repo}`,
                    base: 'master',
                    body: `This PR syncs the package from the [${github.context.repo.repo}](https://github.com/blockeraai/${github.context.repo.repo}) repository.`
                });

                logInfo('success', `Created The Sync package from ${github.context.repo.repo} Repo Pull Request.`);
            } catch (e) {
                logInfo('error', e.message);
            }
        }
    });
};

/**
 * Main function to handle the GitHub Action workflow.
 *
 * @returns {Promise<void>}
 */
export const run = async () => {
    // Set up Git configuration.
    const git = simpleGit();

    // Apply the user.name and user.email globally or within the repo.
    await git.addConfig('user.name', getInput('USERNAME'), undefined, {global: true}).catch((error) => {
        logInfo('error', error.message);
    });
    await git.addConfig('user.email', getInput('EMAIL'), undefined, {
        global: true
    }).catch((error) => {
        logInfo('error', error.message);
    });

    // Get the current repository information from the context.
    const {owner, repo: repoId} = github.context.repo;

    // Construct the HTTPS URL for the current repository.
    const currentRepoURL = `https://github.com/${owner}/${repoId}.git`;

    // Read blockera-folder-sync.json files from current repository!
    const packages = await readBlockeraFiles();
    logInfo('info', `Package paths are ${packages}`);

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
        const repoPath = `https://x-access-token:${getInput(
            'TOKEN'
        )}@${repositoryURL}`;

        // Try to clone of repository ...
        await git.clone(repoPath, repoDir).catch((error) => {
            logInfo('error', error.message);
        });

        // Set remote with access token for pushing.
        await git.cwd(repoDir).catch((error) => {
            logInfo('error', error.message);
        });
        await git.remote([
            'set-url',
            'origin',
            repoPath
        ]).catch((error) => {
            logInfo('error', error.message);
        });

        // Apply the user.name and user.email globally or within the repo.
        await git.addConfig('user.name', getInput('USERNAME'), undefined, {global: true}).catch((error) => {
            logInfo('error', error.message);
        });
        await git.addConfig('user.email', getInput('EMAIL'), undefined, {
            global: true
        }).catch((error) => {
            logInfo('error', error.message);
        });

        const branchName = `sync-packages-from-${github.context.repo.repo}`;

        await switchToSyncBranch(git, branchName);

        // Check if there is at least one commit.
        const log = await git.log();
        let diff;

        // Sync package directories.
        for (const packagePath of packagePaths) {
            if (log.total > 1) {
                // There are multiple commits, so HEAD^ can be used.
                diff = await git.diff(['--name-only', 'HEAD^', 'HEAD']);
            } else if (log.total === 1) {
                // Only one commit exists, compare against an empty tree (i.e., first commit).
                diff = await git.diff(['--name-only', 'HEAD']);
            } else {
                // No commits, skip diff.
                info('No commits in the repository.');

                continue;
            }

            logInfo('loading', 'Repository in progress: ' + repo);

            const srcDir = path.join('./', packagePath);
            const destDir = path.join(repoDir, 'packages');

            // Syncing packages ...
            await syncDirectories(srcDir, destDir);
            logInfo('success', `Synced package from ${srcDir} to ${destDir} of ${repo} repository ✅`);
        }

        await commit(git, {
            repo,
            branchName,
            repoIdMatches,
        }).catch((error) => {
            logInfo('error', error.message);
        });
    }
};

run().catch((error) => {
    logInfo('error', error.message);
    setFailed(error.message);
});
