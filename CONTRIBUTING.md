# How to contribute

Great to see you here!

Datagram is a 100% open-source project from code to everything else, so your decision to contribute is what's keeping the project alive.

Datagram is looking for contributors from every field from developers to user experience designers to marketers. So whatever your skill is, you are welcome to join the Datagram community.

> If you want to participate in the development, the fastest way to get started is to head to [our project workboard](https://github.com/machianists/datagram-node/projects/1) to see what tasks need to get done right now.

The best way to reach us is to send a message to [@machianists](https://twitter.com/machianists) on Twitter or opening an issue in Github. No need to sound official or formal. Just tell us what you would be interested in doing, and we will take it from there.

## Testing

datagram-node uses Tape for tests. Please write tests for new code you create.

## Submitting changes

Please send a [GitHub Pull Request to datagram-node](https://github.com/machianists/datagram-node/pull/new/master) with a clear list of what you've done (read more about [pull requests](http://help.github.com/pull-requests/)). When you send a pull request, you have to include tests or otherwise, the pull request can't be reviewed and will be declined. Our users are the most important priority, and we want to minimize the amount of untested code the users need to run.

Please follow our coding conventions (below) and make sure all of your commits are atomic (one feature per commit).

Always write a clear log message for your commits. One-line messages are fine for small changes, but more significant changes should look like this:

    $ git commit -m "A brief summary of the commit
    > 
    > A paragraph describing what changed and its impact."

**Note about cosmetic, whitespace fixes, code formatting etc. patches**

Changes that are cosmetic in nature and do not add anything substantial to the stability, functionality, or testability of Datagram will generally not be accepted. These changes need to be reviewed just like any other pull requests and unfortunately we don't have resources for that now. Code quality is important but it needs to happen in a form of refactoring.

## Coding conventions

Start reading our code, and you'll get the hang of it. We optimize for readability:

  * We use vanilla ES6 because datagram-node needs to run on Node without compiling
  * Use callbacks for control flow. No promises or await/async (for now).
  * Follow [JavaScript Standard Style](https://standardjs.com/rules.html) with the following exceptions:
    * snake_cases for variables
    * camelCase for functions
    * UPPERCASE for constants
    * no space before function arguments
    * use dangling commas (makes it easier to rearrange lists)
    * no var, use let and const (avoids nasty scope leaks)

Thanks,\
Marko Polojärvi ([@markopolojarvi](https://twitter.com/markopolojarvi))
