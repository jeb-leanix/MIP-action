
const fetch = require('node-fetch');

const myHeaders = {
    'Authorization': "token " + process.env.GITHUB_API_TOKEN
};

// TODO Handle develop
// The maximum page size is 100
async function fetchLeadTimes(repo) {
    return fetch("https://api.github.com/repos/leanix/" + repo.name + "/pulls?state=closed&base=" + repo.baseBranch + "&per_page=10", { headers: myHeaders })
        .then(response => response.json())
        .then(prs =>
            Promise.all(prs.filter(pr => pr.merged_at)
                .map(pr =>
                    fetch(pr._links.commits.href, { headers: myHeaders })
                        .then(response => response.json())
                        .then(commits => commits.map(commit => commit.commit.committer.date)[0])
                        .then(commit => Date.parse(pr.merged_at) - Date.parse(commit))
                        .then(durationMs => Math.ceil(durationMs / 1000 / 60))
                        .then(durationMin => ({
                            baseBranch: repo.baseBranch,
                            repository: repo.name,
                            merged_at: pr.merged_at,
                            durationMin
                        }))
                )
            )
        )
}

const repos = [
    { name: 'camunda', baseBranch: 'master' },
    { name: 'leanix-pathfinder', baseBranch: 'develop' }
];

async function main() {
    const prOpenTimes = await Promise.all(repos.map(repo => fetchLeadTimes(repo)));
    const untilReleaseTimes = await Promise.all(prOpenTimes
        .map(prOpenTimeOfRepo => Promise.all(prOpenTimeOfRepo
            .filter(prOpenTime => prOpenTime.baseBranch != 'master')
            .map(prOpenTime => fetch("https://api.github.com/repos/leanix/" + prOpenTime.repository + "/commits?sha=" + prOpenTime.baseBranch + "&since=" + prOpenTime.merged_at, { headers: myHeaders })
                .then(response => response.json())
                .then(commits => commits
                    .map(commit => commit.commit)
                    .filter(commit => commit.message.startsWith("Merge release branch"))
                )
                .then(commits => commits[commits.length - 1])
                .then(commit => commit.committer.date)
                .then(commitDate => Date.parse(commitDate) - Date.parse(prOpenTime.merged_at))
                .then(durationMs => Math.ceil(durationMs / 1000 / 60))
                .then(untilReleaseMin => ({
                    repository: prOpenTime.repository,
                    merged_at: prOpenTime.merged_at,
                    untilReleaseMin
                }))
            ))
        ));
    console.log(prOpenTimes);
    console.log(untilReleaseTimes);
}

main();