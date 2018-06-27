import Log from "../../../common/Log";
import Config, {ConfigKey} from "../../../common/Config";
import Util from "../../../common/Util";

import {Repository, Team} from "../Types";
import {GitHubActions} from "./util/GitHubActions";

export interface IGitHubController {
    /**
     * This is a complex method that provisions an entire repository.
     *
     * Assumptions: a 'staff' repo must also exist.
     *
     * @param {string} repoName
     * @param {Team[]} teams
     * @param {string} sourceRepo
     * @param {string} webhookAddress
     * @returns {Promise<boolean>}
     */
    provisionRepository(repoName: string, teams: Team[], sourceRepo: string, webhookAddress: string): Promise<boolean>;

    createPullRequest(repoName: string, prName: string): Promise<boolean>;

    getRepositoryUrl(repo: Repository): Promise<string>;

    getTeamUrl(team: Team): Promise<string>;
}

export interface GitTeamTuple {
    teamName: string,
    githubTeamNumber: number
}

export class GitHubController implements IGitHubController {

    public async getRepositoryUrl(repo: Repository): Promise<string> {
        Log.info("GitHubController::GetRepositoryUrl");
        // HACK: hardcoded for sddm:
        const url = "https://github.com/secapstone/" + repo.id;
        Log.info("GitHubController::GetRepositoryUrl( " + repo.id + " ) - URL: " + url);
        return url;
    }

    public async getTeamUrl(team: Team): Promise<string> {
        // HACK: hardcoded for sddm:
        const teamUrl = "https://github.com/orgs/SECapstone/teams/" + team.id;
        Log.info("GitHubController::getTeamUrl( " + team.id + " ) - URL: " + teamUrl);
        return teamUrl;
    }

    public async provisionRepository(repoName: string, teams: Team[], sourceRepo: string, webhookAddress: string): Promise<boolean> {
        const org = Config.getInstance().getProp(ConfigKey.org);
        Log.info("GitHubController::provisionRepository( " + org + ", " + repoName + ", ...) - start");
        const start = Date.now();
        try {
            const gh = new GitHubActions();

            if (teams.length < 1 || teams.length > 1) {
                Log.info("GitHubController::provisionRepository(..) - only the first team will be added to the repo");
            }

            try {
                Log.trace("GitHubController::provisionRepository() - see if repo already exists");
                let repoVal = await gh.repoExists(repoName);
                Log.trace('GHA::provisionRepository(..) - repo exists: ' + repoVal);
                if (repoVal === true) {
                    // this is fatal, we can't provision a repo that already exists
                    Log.error("GitHubController::provisionRepository() - repo already exists; provisioning failed");
                    return false;
                }
            } catch (err) {
                Log.error("GitHubController::provisionRepository() - repo already exists; ERROR: " + err);
                return false;
            }

            try {
                // create a repo
                Log.trace("GitHubController::provisionRepository() - create GitHub repo");
                let repoVal = await gh.createRepo(repoName);
                Log.trace('GHA::provisionRepository(..) - repo: ' + repoVal);
                // expect(repoVal).to.equal('https://github.com/SECapstone/' + Test.REPONAME1);
            } catch (err) {
                Log.error('GHA::provisionRepository(..) - create repo error: ' + err);
                // repo creation failed; remove if needed (requires createRepo be permissive if already exists)
                let res = await gh.deleteRepo(repoName);
                Log.info('GHA::provisionRepository(..) - repo removed: ' + res);
                return false;
            }

            let teamValue = null;
            try {
                // HARDCODE: assume one team
                Log.trace("GitHubController::provisionRepository() - create GitHub team");
                teamValue = await gh.createTeam(teams[0].id, 'push');
                Log.trace('GHA::provisionRepository(..) createTeam: ' + teamValue.teamName);
                // expect(val.teamName).to.equal(Test.TEAMNAME1);
                // expect(val.githubTeamNumber).to.be.an('number');
                // expect(val.githubTeamNumber > 0).to.be.true;
            } catch (err) {
                Log.error("GitHubController::provisionRepository() - create team ERROR: " + err);
            }

            Log.trace("GitHubController::provisionRepository() - add members to GitHub team");
            let addMembers = await gh.addMembersToTeam(teamValue.teamName, teamValue.githubTeamNumber, teams[0].personIds);
            Log.trace('GHA::provisionRepository(..) - addMembers: ' + addMembers.teamName);
            // expect(addMembers.teamName).to.equal(Test.TEAMNAME1); // not a strong test

            Log.trace("GitHubController::provisionRepository() - add team to repo");
            let teamAdd = await gh.addTeamToRepo(teamValue.githubTeamNumber, repoName, 'push');
            Log.trace('GHA::provisionRepository(..) - team name: ' + teamAdd.teamName);
            // expect(teamAdd.githubTeamNumber).to.equal(val.githubTeamNumber);

            Log.trace("GitHubController::provisionRepository() - add staff team to repo");
            let staffTeamNumber = await gh.getTeamNumber('staff');
            Log.trace('GHA::provisionRepository(..) - staffTeamNumber: ' + staffTeamNumber);
            let staffAdd = await gh.addTeamToRepo(staffTeamNumber, repoName, 'admin');
            Log.trace('GHA::provisionRepository(..) - team name: ' + staffAdd.teamName);
            // expect(staffAdd.githubTeamNumber).to.equal(staffTeamNumber);

            // add webhooks
            Log.trace("GitHubController::provisionRepository() - add webhook");
            let createHook = await gh.addWebhook(repoName, webhookAddress);
            Log.trace('GHA::provisionRepository(..) - webook successful: ' + createHook);
            // expect(createHook).to.be.true;

            // perform import
            let targetUrl = 'https://github.com/SECapstone/' + repoName; // HACK: hardcode
            let importUrl = 'https://github.com/SECapstone/bootstrap';
            Log.trace("GitHubController::provisionRepository() - importing project (slow)");
            let output = await gh.importRepoFS(importUrl, targetUrl);
            Log.trace('GHA::provisionRepository(..) - import complete; success: ' + output);
            // expect(output).to.be.true;

            Log.trace('GHA::provisionRepository(..) - successfully completed for: ' + repoName + '; took: ' + Util.took(start));
            return true;
        } catch (err) {
            Log.error('GitHubController::provisionRepository(..) - ERROR: ' + err);
        }
        return false;
    }

    public async createPullRequest(repoName: string, prName: string): Promise<boolean> {
        Log.error("GitHubController::createPullRequest(..) - NOT IMPLEMENTED");
        return true;
    }
}

export class TestGitHubController implements IGitHubController {

    public async getRepositoryUrl(repo: Repository): Promise<string> {
        Log.error("TestGitHubController::getRepositoryUrl(..) - NOT IMPLEMENTED");
        return "TODO";
    }

    public async getTeamUrl(team: Team): Promise<string> {
        Log.error("TestGitHubController::getTeamUrl(..) - NOT IMPLEMENTED");
        // const URL = this.gha.getTeamNumber()
        return "TODO";
    }

    public async provisionRepository(repoName: string, teams: Team[], sourceRepo: string, webhookAddress: string): Promise<boolean> {
        Log.error("TestGitHubController::provisionRepository(..) - NOT IMPLEMENTED");
        return true;
    }

    public async createPullRequest(repoName: string, prName: string): Promise<boolean> {
        Log.error("TestGitHubController::createPullRequest(..) - NOT IMPLEMENTED");
        return true;
    }
}



