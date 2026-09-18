// The composer starts the existing issue workflow; it does not pretend to be a general chatbot.
export function parseIssueRequest(message) {
  const issueLink = message.match(
    /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/([1-9]\d*)(?=$|[\s/#?])/i,
  );
  if (issueLink)
    return {
      repo_url: "https://github.com/" + issueLink[1],
      issue: issueLink[2],
    };
  const repositoryLink = message.match(
    /https:\/\/github\.com\/([\w.-]+\/[\w.-]+)(?=$|[\s/])/i,
  );
  const issueNumber = message.match(/(?:#|\bissue\s+)([1-9]\d*)\b/i);
  if (repositoryLink && issueNumber) {
    return {
      repo_url: "https://github.com/" + repositoryLink[1].replace(/\.git$/, ""),
      issue: issueNumber[1],
    };
  }
  throw new Error(
    "Paste a GitHub issue URL, or a repository URL followed by an issue number such as #25.",
  );
}
