import {getOpenedPullRequest} from "./helpers";

const {info, setFailed, getInput} = require('@actions/core');
const github = require('@actions/github');
const simpleGit = require('simple-git');
const path = require('path');
const {syncDirectories, readBlockeraFiles} = require('./helpers');

/**
 * Main function to handle the GitHub Action workflow.
 *
 * @returns {Promise<void>}
 */
export const run = async () => {
    try {
        // Set up Git configuration.
        const git = simpleGit();

        // Apply the user.name and user.email globally or within the repo.
        await git.addConfig('user.name', 'blockerabot', undefined, {global: true});
        await git.addConfig('user.email', 'blockeraai+githubbot@gmail.com', undefined, {
            global: true
        });

        // Get the current repository information from the context.
        const {owner, repo: repoId} = github.context.repo;

        // Construct the HTTPS URL for the current repository.
        const currentRepoURL = `https://github.com/${owner}/${repoId}.git`;

        // Read blockera-folder-sync.json files from current repository!
        const packages = await readBlockeraFiles();
        info(`Package paths: ${packages}`);

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
                'BLOCKERABOT_PAT'
            )}@${repositoryURL}`;

            // Try to clone of repository ...
            await git.clone(repoPath, repoDir);

            // Set remote with access token for pushing.
            await git.cwd(repoDir);
            await git.remote([
                'set-url',
                'origin',
                repoPath
            ]);

            // Apply the user.name and user.email globally or within the repo.
            await git.addConfig('user.name', 'blockerabot', undefined, {global: true});
            await git.addConfig('user.email', 'blockeraai+githubbot@gmail.com', undefined, {
                global: true
            });

            const branchName = `sync-packages-from-${github.context.repo.repo}`;

            info(`Create branch: ${branchName} ✅`);

            git.checkout(['-b', branchName]).catch(async (error) => {
                if (/A branch named '.*' already exists\./gi.test(e.message)) {
                    await git.checkout([branchName]);
                    await git.pull('origin', 'main', { '--rebase': 'true' });

                    info('🎚Switch to exists branch')
                } else {
                    throw new Error(error);
                }
            });

            info(`Git Pull from origin ${branchName} ✅`);
            await git.pull('origin', branchName, ['--force']);

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

                console.log('Repository in progress: ' + repo);

                const srcDir = path.join('./', packagePath);
                const destDir = path.join(repoDir, 'packages');

                // Syncing packages ...
                await syncDirectories(srcDir, destDir);
                info(`Synced package from ${srcDir} to ${destDir} of ${repo} repository ✅`);
            }

            // Commit changes.
            await git.add('./*');
            await git.commit(`Sync shared packages from ${github.context.repo.repo}`);

            info(`Commit Changelog ✅`);

            // Push changes and create PR.
            await git.push('origin', branchName);
            info(`Changes pushed to ${repo} ✅`);

            getOpenedPullRequest().then((data) => {
                if (!data.length) {
                    // Use octokit to create a pull request.
                    const octokit = github.getOctokit(getInput('BLOCKERABOT_PAT'));
                    octokit.rest.pulls.create({
                        owner: github.context.repo.owner,
                        repo: repoIdMatches[1],
                        title: `Sync package from ${github.context.repo.repo} Repo`,
                        head: `sync-packages-from-${github.context.repo.repo}`,
                        base: 'master',
                        body: `This PR syncs the package from the [${github.context.repo.repo}](https://github.com/blockeraai/${github.context.repo.repo}) repository.`
                    });
                }
            });
        }
    } catch (error) {
        console.log('Error log for Run:', error);

        // No commits between master and sync-packages-from-${branchName}
        if (422 === error.status) {
            return;
        }

        setFailed(error.message);
    }
};

const result = run();

result.catch((error) => {
    console.log('Error log for Results:', error);

    // No commits between master and sync-packages-from-${branchName}.
    if (422 === error.status) {
        return;
    }

    setFailed(error.message);
});
